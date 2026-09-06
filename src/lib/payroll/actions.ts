'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/session';
import { requirePermission, hasPermission } from '@/lib/auth/permissions';
import { writeAudit } from '@/lib/audit/log';
import { EmployeeSchema, RateSchema } from '@/lib/validation/payroll';
import { RATE_KIND, isPaymentMethod, type PaymentMethod } from '@/lib/payroll/methods';

type Method = PaymentMethod;

/** Record a salary payment to an employee (posts a charge to Finance). */
export async function recordSalaryPayment(formData: FormData): Promise<void> {
  await requirePermission('payroll.pay');
  const employeeId = String(formData.get('employeeId') ?? '');
  const amount = Number(formData.get('amount'));
  const paidOn = String(formData.get('paidOn') ?? '');
  const note = String(formData.get('note') ?? '').trim();

  if (!employeeId || !(amount > 0)) {
    redirect(`/users?error=${encodeURIComponent('Entrez un montant valide.')}`);
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc('record_salary_payment', {
    p_employee_id: employeeId,
    p_amount: amount,
    p_paid_on: /^\d{4}-\d{2}-\d{2}$/.test(paidOn) ? paidOn : null,
    p_note: note || null,
  });
  if (error) {
    redirect(`/users?error=${encodeURIComponent('Impossible d’enregistrer le paiement.')}`);
  }
  revalidatePath('/users');
  revalidatePath('/finance');
  redirect('/users?msg=Paiement+enregistré.');
}

/**
 * Set a user's remuneration: link (or create) a payroll employee for the given
 * profile, set its payment method, and record the amount as its active payroll
 * rate. This feeds the real payroll module — periods, records and payments —
 * so it is tracked, not cosmetic.
 */
export async function setUserRemuneration(formData: FormData): Promise<void> {
  await requirePermission('employees.manage');
  const actor = await requireUser();
  const userId = String(formData.get('userId') ?? '');
  const method = String(formData.get('method') ?? '') as Method;
  const amount = Number(formData.get('amount'));

  if (!(await hasPermission('payroll.manage'))) {
    redirect(`/users/${userId}?error=${encodeURIComponent('You need payroll.manage to set remuneration.')}`);
  }
  if (!userId || !isPaymentMethod(method)) {
    redirect(`/users/${userId}?error=${encodeURIComponent('Choose a valid payment method.')}`);
  }
  if (!(amount >= 0)) {
    redirect(`/users/${userId}?error=${encodeURIComponent('Enter a valid amount.')}`);
  }

  const supabase = await createClient();

  // Resolve or create the linked employee.
  const { data: existing } = await supabase
    .from('employees')
    .select('id')
    .eq('profile_id', userId)
    .maybeSingle();

  let employeeId = existing?.id as string | undefined;
  if (employeeId) {
    const { error } = await supabase
      .from('employees')
      .update({ payment_method: method })
      .eq('id', employeeId);
    if (error) {
      redirect(`/users/${userId}?error=${encodeURIComponent('Could not update the employee.')}`);
    }
  } else {
    const { data: prof } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .maybeSingle();
    const { data: emp, error } = await supabase
      .from('employees')
      .insert({
        full_name: (prof?.full_name as string) || 'Employé',
        profile_id: userId,
        payment_method: method,
        department: 'LABORATORY',
        created_by: actor.id,
      })
      .select('id')
      .single();
    if (error || !emp) {
      redirect(`/users/${userId}?error=${encodeURIComponent('Could not create the employee.')}`);
    }
    employeeId = emp!.id as string;
  }

  // Replace the active rate with the new amount for the chosen method.
  await supabase
    .from('payroll_rates')
    .update({ is_active: false })
    .eq('employee_id', employeeId)
    .eq('is_active', true);

  const { error: rateErr } = await supabase.from('payroll_rates').insert({
    employee_id: employeeId,
    rate: amount,
    rate_kind: RATE_KIND[method],
    effective_from: new Date().toISOString().slice(0, 10),
    is_active: true,
    created_by: actor.id,
  });
  if (rateErr) {
    redirect(`/users/${userId}?error=${encodeURIComponent('Could not save the rate.')}`);
  }

  await writeAudit({
    actorId: actor.id,
    action: 'payroll.remuneration.set',
    entityType: 'employee',
    entityId: employeeId,
    metadata: { profile_id: userId, method, amount },
  });

  revalidatePath(`/users/${userId}`);
  revalidatePath('/payroll');
  redirect(`/users/${userId}?msg=Remuneration+saved.`);
}

export type PayrollFormState = { error?: string; fieldErrors?: Record<string, string> };

function fieldErrors(issues: readonly { path: PropertyKey[]; message: string }[]) {
  const fe: Record<string, string> = {};
  for (const i of issues) {
    const k = typeof i.path[0] === 'string' ? i.path[0] : '';
    if (k && !fe[k]) fe[k] = i.message;
  }
  return fe;
}

export async function createEmployee(
  _prev: PayrollFormState,
  formData: FormData,
): Promise<PayrollFormState> {
  await requirePermission('employees.manage');
  const actor = await requireUser();
  const parsed = EmployeeSchema.safeParse({
    fullName: formData.get('fullName'),
    code: formData.get('code') ?? '',
    phone: formData.get('phone') ?? '',
    job: formData.get('job') ?? '',
    department: formData.get('department') ?? 'LABORATORY',
    paymentMethod: formData.get('paymentMethod'),
    isActive: true,
  });
  if (!parsed.success) return { error: 'Please fix the highlighted fields.', fieldErrors: fieldErrors(parsed.error.issues) };
  const d = parsed.data;

  const supabase = await createClient();
  const { data: emp, error } = await supabase
    .from('employees')
    .insert({
      full_name: d.fullName,
      code: d.code || null,
      phone: d.phone || null,
      job: d.job || null,
      department: d.department,
      payment_method: d.paymentMethod,
      created_by: actor.id,
    })
    .select('id')
    .single();
  if (error) return { error: /duplicate|unique/i.test(error.message) ? 'That employee code already exists.' : 'Could not create the employee.' };

  await writeAudit({ actorId: actor.id, action: 'employee.create', entityType: 'employee', entityId: emp.id, metadata: { name: d.fullName } });
  revalidatePath('/payroll');
  redirect('/payroll?msg=Employee+created.');
}

export async function updateEmployee(
  _prev: PayrollFormState,
  formData: FormData,
): Promise<PayrollFormState> {
  await requirePermission('employees.manage');
  const actor = await requireUser();
  const id = String(formData.get('employeeId') ?? '');
  const parsed = EmployeeSchema.safeParse({
    fullName: formData.get('fullName'),
    code: formData.get('code') ?? '',
    phone: formData.get('phone') ?? '',
    job: formData.get('job') ?? '',
    department: formData.get('department') ?? 'LABORATORY',
    paymentMethod: formData.get('paymentMethod'),
    isActive: formData.get('isActive') === 'on',
  });
  if (!parsed.success) return { error: 'Please fix the highlighted fields.', fieldErrors: fieldErrors(parsed.error.issues) };
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from('employees')
    .update({
      full_name: d.fullName,
      code: d.code || null,
      phone: d.phone || null,
      job: d.job || null,
      department: d.department,
      payment_method: d.paymentMethod,
      is_active: d.isActive,
    })
    .eq('id', id);
  if (error) return { error: 'Could not update the employee.' };

  await writeAudit({ actorId: actor.id, action: 'employee.update', entityType: 'employee', entityId: id });
  revalidatePath('/payroll');
  revalidatePath(`/payroll/${id}`);
  redirect(`/payroll/${id}?msg=Employee+updated.`);
}

export async function createRate(
  _prev: PayrollFormState,
  formData: FormData,
): Promise<PayrollFormState> {
  await requirePermission('payroll.manage');
  const actor = await requireUser();
  const parsed = RateSchema.safeParse({
    employeeId: formData.get('employeeId') ?? '',
    job: formData.get('job') ?? '',
    workCategory: formData.get('workCategory') ?? '',
    productSize: formData.get('productSize') ?? '',
    rate: formData.get('rate'),
    rateKind: formData.get('rateKind'),
    effectiveFrom: formData.get('effectiveFrom'),
  });
  if (!parsed.success) return { error: 'Please fix the highlighted fields.', fieldErrors: fieldErrors(parsed.error.issues) };
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from('payroll_rates').insert({
    employee_id: d.employeeId || null,
    job: d.job || null,
    work_category: d.workCategory || null,
    product_size: d.productSize || null,
    rate: d.rate,
    rate_kind: d.rateKind,
    effective_from: d.effectiveFrom,
    created_by: actor.id,
  });
  if (error) return { error: 'Could not create the rate.' };

  await writeAudit({ actorId: actor.id, action: 'payroll.rate.create', entityType: 'payroll_rate', metadata: { rate: d.rate, kind: d.rateKind } });
  revalidatePath('/payroll/rates');
  redirect('/payroll/rates?msg=Rate+added.');
}

export async function deleteRate(formData: FormData): Promise<void> {
  await requirePermission('payroll.manage');
  const id = String(formData.get('rateId') ?? '');
  const supabase = await createClient();
  await supabase.from('payroll_rates').delete().eq('id', id);
  revalidatePath('/payroll/rates');
  redirect('/payroll/rates?msg=Rate+removed.');
}

export async function addWorkRecord(
  _prev: PayrollFormState,
  formData: FormData,
): Promise<PayrollFormState> {
  await requirePermission('payroll.manage');
  const employeeId = String(formData.get('employeeId') ?? '');
  const workDate = String(formData.get('workDate') || '');
  const workCategory = String(formData.get('workCategory') || '') || null;
  const productSize = String(formData.get('productSize') || '') || null;
  const quantity = Number(formData.get('quantity'));

  if (!(quantity > 0)) return { error: 'Quantity must be positive.', fieldErrors: { quantity: 'Required' } };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) return { error: 'Choose a valid date.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('add_work_record', {
    p_employee_id: employeeId,
    p_work_date: workDate,
    p_order_id: null,
    p_work_category: workCategory,
    p_product_size: productSize,
    p_quantity: quantity,
  });
  if (error) {
    return { error: /no matching piece rate/.test(error.message) ? 'No matching piece rate is configured for this work.' : 'Could not add the work record.' };
  }

  revalidatePath(`/payroll/${employeeId}`);
  redirect(`/payroll/${employeeId}?msg=Work+recorded.`);
}

export async function deleteWorkRecord(formData: FormData): Promise<void> {
  await requirePermission('payroll.manage');
  const id = String(formData.get('recordId') ?? '');
  const employeeId = String(formData.get('employeeId') ?? '');
  const supabase = await createClient();
  // Only unassigned (unpaid) records may be removed.
  await supabase.from('piece_work_records').delete().eq('id', id).is('payroll_record_id', null);
  revalidatePath(`/payroll/${employeeId}`);
  redirect(`/payroll/${employeeId}?msg=Record+removed.`);
}

export async function createPeriod(
  _prev: PayrollFormState,
  formData: FormData,
): Promise<PayrollFormState> {
  await requirePermission('payroll.manage');
  const type = String(formData.get('periodType') || '');
  const start = String(formData.get('startDate') || '');
  const end = String(formData.get('endDate') || '');
  const label = String(formData.get('label') || '');

  if (!['DAILY', 'WEEKLY', 'MONTHLY'].includes(type)) return { error: 'Choose a period type.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return { error: 'Choose valid dates.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('create_payroll_period', {
    p_type: type, p_start: start, p_end: end, p_label: label || null,
  });
  if (error) return { error: 'Could not create the period.' };

  revalidatePath('/payroll/periods');
  redirect('/payroll/periods?msg=Period+created.');
}

export async function calculatePayroll(formData: FormData): Promise<void> {
  await requirePermission('payroll.manage');
  const employeeId = String(formData.get('employeeId') ?? '');
  const periodId = String(formData.get('periodId') ?? '');
  const workedDaysRaw = formData.get('workedDays');
  const workedDays = workedDaysRaw ? Number(workedDaysRaw) : null;

  const supabase = await createClient();
  const { error } = await supabase.rpc('calculate_payroll', {
    p_employee_id: employeeId,
    p_period_id: periodId,
    p_worked_days: workedDays,
  });
  if (error) {
    redirect(`/payroll/periods/${periodId}?error=${encodeURIComponent('Could not calculate payroll.')}`);
  }
  revalidatePath(`/payroll/periods/${periodId}`);
  redirect(`/payroll/periods/${periodId}?msg=Calculated.`);
}

export async function recordAdvance(
  _prev: PayrollFormState,
  formData: FormData,
): Promise<PayrollFormState> {
  await requirePermission('payroll.pay');
  const employeeId = String(formData.get('employeeId') ?? '');
  const amount = Number(formData.get('amount'));
  const advanceDate = String(formData.get('advanceDate') || '');
  if (!(amount > 0)) return { error: 'Amount must be positive.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(advanceDate)) return { error: 'Choose a valid date.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('record_payroll_advance', {
    p_employee_id: employeeId,
    p_amount: amount,
    p_advance_date: advanceDate,
  });
  if (error) return { error: 'Could not record the advance.' };

  revalidatePath(`/payroll/${employeeId}`);
  revalidatePath('/finance');
  redirect(`/payroll/${employeeId}?msg=Advance+recorded.`);
}

export async function recordPayrollPayment(formData: FormData): Promise<void> {
  await requirePermission('payroll.pay');
  const recordId = String(formData.get('recordId') ?? '');
  const periodId = String(formData.get('periodId') ?? '');
  const amount = Number(formData.get('amount'));
  if (!(amount > 0)) {
    redirect(`/payroll/periods/${periodId}?error=${encodeURIComponent('Enter a valid amount.')}`);
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc('record_payroll_payment', {
    p_record_id: recordId,
    p_amount: amount,
  });
  if (error) {
    redirect(`/payroll/periods/${periodId}?error=${encodeURIComponent(/exceeds/.test(error.message) ? 'Payment exceeds the remaining amount.' : 'Could not record the payment.')}`);
  }
  revalidatePath(`/payroll/periods/${periodId}`);
  revalidatePath('/finance');
  redirect(`/payroll/periods/${periodId}?msg=Payment+recorded.`);
}
