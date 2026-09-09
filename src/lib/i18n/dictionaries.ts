import type { Locale } from './config';

export type Dict = {
  dir: 'ltr' | 'rtl';
  nav: Record<string, string>;
  sections: Record<string, string>;
  common: Record<string, string>;
};

export const dictionaries: Record<Locale, Dict> = {
  en: {
    dir: 'ltr',
    nav: {
      '/dashboard': 'Dashboard',
      '/orders': 'Orders',
      '/production-sheets': 'Production Sheets',
      '/attendance': 'Attendance',
      '/clients': 'Clients',
      '/calendar': 'Calendar',
      '/products': 'Products',
      '/whatsapp': 'WhatsApp',
      '/finance': 'Cash Register',
      '/finance/reports': 'Analytics',
      '/finance/magasin': 'Magasin',
      '/finance/categories': 'Categories',
      '/users': 'Users',
      '/roles': 'Roles',
      '/statuses': 'Statuses',
      '/settings': 'Settings',
    },
    sections: {
      Overview: 'Overview',
      Operations: 'Operations',
      Finance: 'Finance',
      Administration: 'Administration',
    },
    common: {
      signOut: 'Sign out',
      language: 'Language',
      switchToArabic: 'العربية',
      switchToEnglish: 'English',
    },
  },
  ar: {
    dir: 'rtl',
    nav: {
      '/dashboard': 'لوحة التحكم',
      '/orders': 'الطلبات',
      '/production-sheets': 'أوراق الإنتاج',
      '/attendance': 'الحضور',
      '/clients': 'العملاء',
      '/calendar': 'التقويم',
      '/products': 'المنتجات',
      '/whatsapp': 'واتساب',
      '/finance': 'الخزينة',
      '/finance/reports': 'التحليلات',
      '/finance/magasin': 'المتجر',
      '/finance/categories': 'الفئات',
      '/users': 'المستخدمون',
      '/roles': 'الأدوار',
      '/statuses': 'الحالات',
      '/settings': 'الإعدادات',
    },
    sections: {
      Overview: 'نظرة عامة',
      Operations: 'العمليات',
      Finance: 'المالية',
      Administration: 'الإدارة',
    },
    common: {
      signOut: 'تسجيل الخروج',
      language: 'اللغة',
      switchToArabic: 'العربية',
      switchToEnglish: 'English',
    },
  },
};
