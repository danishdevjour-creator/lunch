// Shared language + theme handling for the dashboard and the member pay page.
// Loaded in <head> so the saved theme/language apply before first paint.

const I18N = {
  en: {
    'brand.tagline': 'Lunch budget',
    'lang.label': 'Language',
    'theme.toggle': 'Toggle dark mode',
    'menu.toggle': 'Menu',
    'nav.overview': 'Overview',
    'nav.members': 'Members',
    'nav.lunch': 'Record lunch',
    'nav.payments': 'Payments',
    'nav.emails': 'Email log',
    'nav.settings': 'Settings',
    'auth.login': 'Login',
    'auth.logout': 'Logout',
    'login.title': 'Welcome back',
    'login.subtitle': "Sign in to manage your team's lunch budget.",
    'login.password': 'Password',
    'login.submit': 'Login',

    'overview.title': 'Overview',
    'stat.collected': 'Total collected',
    'stat.spent': 'Total spent',
    'stat.balance': 'Remaining balance',
    'stat.members': 'Members',
    'stat.pending': 'Pending payments',
    'overview.alerts': 'Balance finished / low',
    'overview.chart': 'Last 6 months',
    'overview.recent': 'Recent activity',
    'overview.allGood': 'Everyone has enough balance 🎉',
    'legend.collected': 'Collected',
    'legend.spent': 'Spent',
    'chart.noData': 'No data yet',
    'notice.email': 'Email (SMTP) is not configured, so alert emails are only logged, not sent.',
    'notice.jazzcash': 'JazzCash online checkout is off; members can still pay manually and enter their TID.',
    'notice.meezan': 'Meezan online gateway is off; members can still transfer to the bank account and enter the reference.',

    'col.member': 'Member',
    'col.balance': 'Balance',
    'col.date': 'Date',
    'col.type': 'Type',
    'col.method': 'Method',
    'col.amount': 'Amount',
    'col.status': 'Status',
    'col.name': 'Name',
    'col.email': 'Email',
    'col.phone': 'Phone',
    'col.deposited': 'Deposited',
    'col.spent': 'Spent',
    'col.remaining': 'Remaining',
    'col.description': 'Description',
    'col.people': 'People',
    'col.each': 'Each',
    'col.total': 'Total',
    'col.reference': 'Reference / TID',
    'col.to': 'To',
    'col.subject': 'Subject',
    'col.detail': 'Detail',
    'table.nothing': 'Nothing here',

    'status.ok': 'OK',
    'status.low': 'Low',
    'status.finished': 'Finished',
    'status.inactive': 'Inactive',
    'status.pending': 'Pending',
    'status.approved': 'Approved',
    'status.rejected': 'Rejected',
    'status.sent': 'Sent',
    'status.failed': 'Failed',
    'status.logged': 'Logged',
    'type.deposit': 'Deposit',
    'type.expense': 'Expense',
    'method.cash': 'Cash',
    'method.jazzcash': 'JazzCash',
    'method.meezan': 'Meezan Bank',
    'method.adjustment': 'Adjustment',
    'method.lunch': 'Lunch',

    'btn.cancel': 'Cancel',
    'btn.save': 'Save',
    'btn.delete': 'Delete',
    'btn.approve': 'Approve',
    'btn.reject': 'Reject',
    'btn.sendEmail': 'Send email',
    'btn.addMoney': '+ Money',
    'btn.history': 'History',
    'btn.payLink': 'Pay link',
    'btn.email': 'Email',
    'btn.edit': 'Edit',
    'btn.selectAll': 'Select all',
    'btn.clear': 'Clear',

    'members.title': 'Members',
    'members.search': 'Search name / email',
    'members.inactive': 'Show inactive',
    'members.add': '+ Add member',
    'members.empty': 'No members yet. Click "+ Add member".',
    'members.pending': '{amount} pending',
    'member.addTitle': 'Add member',
    'member.editTitle': 'Edit member',
    'member.remove': 'Remove member',
    'member.removeConfirm': 'Remove {name}? Members with history are deactivated instead of deleted.',
    'field.name': 'Name *',
    'field.email': 'Email *',
    'field.phone': 'Phone',
    'field.department': 'Department',
    'field.opening': 'Opening deposit (cash)',
    'field.status': 'Status',
    'field.member': 'Member',
    'field.type': 'Type',
    'field.amount': 'Amount',
    'field.method': 'Method',
    'field.reference': 'Reference / TID',
    'field.note': 'Note',
    'field.date': 'Date',
    'field.description': 'Description',
    'opt.active': 'Active',
    'opt.inactive': 'Inactive',
    'opt.deposit': 'Deposit (money received)',
    'opt.expense': 'Expense / deduction',

    'tx.title': 'Record payment',
    'tx.deleteConfirm': 'Delete this transaction?',
    'history.title': '{name} · {amount} left',
    'history.empty': 'No transactions',
    'history.ref': 'Ref: {ref}',
    'link.title': 'Payment link for {name}',
    'link.help': 'Share this private link with {name}. They can see their balance and pay via JazzCash or Meezan Bank. The link is also included in every alert email.',
    'link.copy': 'Copy link',
    'link.open': 'Open',
    'link.regen': 'Generate new link',
    'link.regenConfirm': 'The old link will stop working. Continue?',

    'lunch.title': 'Record lunch',
    'lunch.details': 'Lunch details',
    'lunch.descPlaceholder': 'e.g. Biryani',
    'lunch.chargeAs': 'Charge as',
    'lunch.perPerson': 'Fixed amount per person',
    'lunch.split': 'Split total bill equally',
    'lunch.amountPerPerson': 'Amount per person',
    'lunch.totalBill': 'Total bill',
    'lunch.who': 'Who had lunch?',
    'lunch.selected': '({n} selected)',
    'lunch.preview': '{n} people × {each} = {total} will be deducted.',
    'lunch.save': 'Save lunch & deduct',
    'lunch.previous': 'Previous lunches',
    'lunch.none': 'No lunches recorded yet',
    'lunch.addMembersFirst': 'Add members first.',
    'lunch.deleteConfirm': 'Delete this lunch and refund everyone?',

    'payments.title': 'Payments',
    'payments.record': '+ Record payment',
    'filter.pending': 'Pending approval',
    'filter.all': 'All transactions',
    'filter.deposits': 'Deposits',
    'filter.expenses': 'Expenses',

    'emails.title': 'Email log',
    'emails.empty': 'No emails yet',

    'settings.title': 'Settings',
    'settings.general': 'General',
    'settings.jazzcash': 'JazzCash (manual transfer)',
    'settings.meezan': 'Meezan Bank (manual transfer)',
    'settings.lowHelp': 'An email goes out once when balance drops to this amount, and again when it reaches 0.',
    'settings.save': 'Save settings',
    'settings.gateway': 'Online checkout: JazzCash {j} · Meezan {m} · Email {e}',
    'settings.gatewayHelp': 'Gateway and SMTP credentials are set as environment variables on the server.',
    'settings.on': 'ON',
    'settings.off': 'OFF',
    'field.company': 'Company name',
    'field.currency': 'Currency symbol',
    'field.defaultLunch': 'Default lunch cost',
    'field.lowAlert': 'Low balance alert at',
    'field.jazzNumber': 'JazzCash number',
    'field.accountTitle': 'Account title',
    'field.accountNumber': 'Account number',
    'field.iban': 'IBAN',
    'field.branch': 'Branch',

    'toast.saved': 'Saved',
    'toast.memberAdded': 'Member added',
    'toast.memberUpdated': 'Member updated',
    'toast.memberDeactivated': 'Member deactivated (history kept)',
    'toast.memberDeleted': 'Member deleted',
    'toast.linkCopied': 'Link copied',
    'toast.lunchSaved': 'Lunch saved: {n} × {each} deducted',
    'toast.lunchDeleted': 'Lunch deleted and refunded',
    'toast.approved': 'Approved, receipt emailed',
    'toast.rejected': 'Rejected',
    'toast.deleted': 'Deleted',
    'toast.settingsSaved': 'Settings saved',
    'toast.emailSent': 'Email sent',
    'toast.emailLogged': 'SMTP not configured, email logged only',
    'toast.emailFailed': 'Email failed: {error}',
    'toast.copyFailed': 'Could not copy, please copy the link manually',

    'pay.pageTitle': 'Add Lunch Money',
    'pay.company': '{company} · Lunch budget',
    'pay.summary': 'Deposited {deposited} · Spent {spent}',
    'pay.awaiting': ' · {amount} awaiting confirmation',
    'pay.addMoney': 'Add money',
    'pay.wallet': 'Mobile wallet',
    'pay.bank': 'Bank transfer / card',
    'pay.amountPh': 'e.g. 3000',
    'pay.payJazz': 'Pay with JazzCash',
    'pay.payMeezan': 'Pay with Meezan Bank',
    'pay.orManual': 'or send manually',
    'pay.jazzDetails': 'Send money to this JazzCash account:',
    'pay.meezanDetails': 'Transfer to this Meezan Bank account:',
    'pay.titleLabel': 'Title',
    'pay.accountNo': 'Account #',
    'pay.tid': 'JazzCash Transaction ID (TID)',
    'pay.bankRef': 'Bank transaction reference / ID',
    'pay.refPh': 'Enter the ID from your payment receipt',
    'pay.sent': 'I have sent the payment',
    'pay.note': 'Your balance updates after the admin confirms the payment.',
    'pay.history': 'Recent history',
    'pay.noHistory': 'No history yet',
    'pay.notSetup': 'Account details have not been set up yet. Please contact the admin.',
    'pay.missingToken': 'This payment link is missing the member code. Ask your admin for your personal link.',
    'pay.enterAmount': 'Please enter an amount',
    'pay.thanks': 'Thanks! Your payment is waiting for admin confirmation.',
    'pay.success': 'Payment successful',
    'pay.failed': 'Payment failed',
  },

  ur: {
    'brand.tagline': 'لنچ بجٹ',
    'lang.label': 'زبان',
    'theme.toggle': 'ڈارک موڈ بدلیں',
    'menu.toggle': 'مینو',
    'nav.overview': 'خلاصہ',
    'nav.members': 'ممبرز',
    'nav.lunch': 'لنچ درج کریں',
    'nav.payments': 'ادائیگیاں',
    'nav.emails': 'ای میل ریکارڈ',
    'nav.settings': 'سیٹنگز',
    'auth.login': 'لاگ اِن',
    'auth.logout': 'لاگ آؤٹ',
    'login.title': 'خوش آمدید',
    'login.subtitle': 'ٹیم کا لنچ بجٹ سنبھالنے کے لیے لاگ اِن کریں۔',
    'login.password': 'پاس ورڈ',
    'login.submit': 'لاگ اِن',

    'overview.title': 'خلاصہ',
    'stat.collected': 'کل جمع شدہ',
    'stat.spent': 'کل خرچ',
    'stat.balance': 'باقی رقم',
    'stat.members': 'ممبرز',
    'stat.pending': 'زیرِ التوا ادائیگیاں',
    'overview.alerts': 'بیلنس ختم / کم',
    'overview.chart': 'پچھلے 6 مہینے',
    'overview.recent': 'حالیہ سرگرمی',
    'overview.allGood': 'سب کے پاس کافی بیلنس ہے 🎉',
    'legend.collected': 'جمع',
    'legend.spent': 'خرچ',
    'chart.noData': 'ابھی کوئی ڈیٹا نہیں',
    'notice.email': 'ای میل (SMTP) سیٹ نہیں، اس لیے الرٹ ای میلز بھیجی نہیں جا رہیں، صرف ریکارڈ ہو رہی ہیں۔',
    'notice.jazzcash': 'جاز کیش آن لائن چیک آؤٹ بند ہے؛ ممبرز دستی ادائیگی کر کے TID درج کر سکتے ہیں۔',
    'notice.meezan': 'میزان آن لائن گیٹ وے بند ہے؛ ممبرز بینک اکاؤنٹ میں رقم بھیج کر ریفرنس درج کر سکتے ہیں۔',

    'col.member': 'ممبر',
    'col.balance': 'بیلنس',
    'col.date': 'تاریخ',
    'col.type': 'قسم',
    'col.method': 'طریقہ',
    'col.amount': 'رقم',
    'col.status': 'حالت',
    'col.name': 'نام',
    'col.email': 'ای میل',
    'col.phone': 'فون',
    'col.deposited': 'جمع کروایا',
    'col.spent': 'خرچ',
    'col.remaining': 'باقی',
    'col.description': 'تفصیل',
    'col.people': 'افراد',
    'col.each': 'فی کس',
    'col.total': 'کل',
    'col.reference': 'ریفرنس / TID',
    'col.to': 'بنام',
    'col.subject': 'موضوع',
    'col.detail': 'تفصیل',
    'table.nothing': 'یہاں کچھ نہیں',

    'status.ok': 'ٹھیک',
    'status.low': 'کم',
    'status.finished': 'ختم',
    'status.inactive': 'غیر فعال',
    'status.pending': 'زیرِ التوا',
    'status.approved': 'منظور',
    'status.rejected': 'مسترد',
    'status.sent': 'بھیج دی',
    'status.failed': 'ناکام',
    'status.logged': 'ریکارڈ',
    'type.deposit': 'جمع',
    'type.expense': 'خرچ',
    'method.cash': 'نقد',
    'method.jazzcash': 'جاز کیش',
    'method.meezan': 'میزان بینک',
    'method.adjustment': 'ایڈجسٹمنٹ',
    'method.lunch': 'لنچ',

    'btn.cancel': 'منسوخ',
    'btn.save': 'محفوظ کریں',
    'btn.delete': 'حذف',
    'btn.approve': 'منظور',
    'btn.reject': 'مسترد',
    'btn.sendEmail': 'ای میل بھیجیں',
    'btn.addMoney': '+ رقم',
    'btn.history': 'تاریخچہ',
    'btn.payLink': 'ادائیگی لنک',
    'btn.email': 'ای میل',
    'btn.edit': 'ترمیم',
    'btn.selectAll': 'سب منتخب',
    'btn.clear': 'صاف',

    'members.title': 'ممبرز',
    'members.search': 'نام / ای میل تلاش کریں',
    'members.inactive': 'غیر فعال دکھائیں',
    'members.add': '+ ممبر شامل کریں',
    'members.empty': 'ابھی کوئی ممبر نہیں۔ "+ ممبر شامل کریں" دبائیں۔',
    'members.pending': '{amount} زیرِ التوا',
    'member.addTitle': 'ممبر شامل کریں',
    'member.editTitle': 'ممبر میں ترمیم',
    'member.remove': 'ممبر ہٹائیں',
    'member.removeConfirm': '{name} کو ہٹائیں؟ جن ممبرز کا ریکارڈ موجود ہے انہیں حذف کے بجائے غیر فعال کر دیا جاتا ہے۔',
    'field.name': 'نام *',
    'field.email': 'ای میل *',
    'field.phone': 'فون',
    'field.department': 'شعبہ',
    'field.opening': 'ابتدائی جمع (نقد)',
    'field.status': 'حالت',
    'field.member': 'ممبر',
    'field.type': 'قسم',
    'field.amount': 'رقم',
    'field.method': 'طریقہ',
    'field.reference': 'ریفرنس / TID',
    'field.note': 'نوٹ',
    'field.date': 'تاریخ',
    'field.description': 'تفصیل',
    'opt.active': 'فعال',
    'opt.inactive': 'غیر فعال',
    'opt.deposit': 'جمع (رقم وصول ہوئی)',
    'opt.expense': 'خرچ / کٹوتی',

    'tx.title': 'ادائیگی درج کریں',
    'tx.deleteConfirm': 'یہ ٹرانزیکشن حذف کریں؟',
    'history.title': '{name} · {amount} باقی',
    'history.empty': 'کوئی ٹرانزیکشن نہیں',
    'history.ref': 'ریفرنس: {ref}',
    'link.title': '{name} کا ادائیگی لنک',
    'link.help': 'یہ نجی لنک {name} کو بھیجیں۔ وہ اپنا بیلنس دیکھ کر جاز کیش یا میزان بینک سے ادائیگی کر سکتے ہیں۔ یہ لنک ہر الرٹ ای میل میں بھی ہوتا ہے۔',
    'link.copy': 'لنک کاپی کریں',
    'link.open': 'کھولیں',
    'link.regen': 'نیا لنک بنائیں',
    'link.regenConfirm': 'پرانا لنک کام کرنا بند کر دے گا۔ جاری رکھیں؟',

    'lunch.title': 'لنچ درج کریں',
    'lunch.details': 'لنچ کی تفصیل',
    'lunch.descPlaceholder': 'مثلاً بریانی',
    'lunch.chargeAs': 'رقم کیسے لگائیں',
    'lunch.perPerson': 'فی کس مقررہ رقم',
    'lunch.split': 'کل بل برابر تقسیم کریں',
    'lunch.amountPerPerson': 'فی کس رقم',
    'lunch.totalBill': 'کل بل',
    'lunch.who': 'کس کس نے لنچ کیا؟',
    'lunch.selected': '({n} منتخب)',
    'lunch.preview': '{n} افراد × {each} = {total} کٹوتی ہوگی۔',
    'lunch.save': 'لنچ محفوظ کریں اور کٹوتی کریں',
    'lunch.previous': 'پچھلے لنچ',
    'lunch.none': 'ابھی کوئی لنچ درج نہیں',
    'lunch.addMembersFirst': 'پہلے ممبرز شامل کریں۔',
    'lunch.deleteConfirm': 'یہ لنچ حذف کر کے سب کو رقم واپس کریں؟',

    'payments.title': 'ادائیگیاں',
    'payments.record': '+ ادائیگی درج کریں',
    'filter.pending': 'منظوری کے منتظر',
    'filter.all': 'تمام ٹرانزیکشنز',
    'filter.deposits': 'جمع',
    'filter.expenses': 'خرچ',

    'emails.title': 'ای میل ریکارڈ',
    'emails.empty': 'ابھی کوئی ای میل نہیں',

    'settings.title': 'سیٹنگز',
    'settings.general': 'عمومی',
    'settings.jazzcash': 'جاز کیش (دستی منتقلی)',
    'settings.meezan': 'میزان بینک (دستی منتقلی)',
    'settings.lowHelp': 'بیلنس اس رقم تک گرنے پر ایک بار ای میل جاتی ہے، اور صفر ہونے پر دوبارہ۔',
    'settings.save': 'سیٹنگز محفوظ کریں',
    'settings.gateway': 'آن لائن چیک آؤٹ: جاز کیش {j} · میزان {m} · ای میل {e}',
    'settings.gatewayHelp': 'گیٹ وے اور SMTP کی معلومات سرور کے environment variables میں درج ہوتی ہیں۔',
    'settings.on': 'آن',
    'settings.off': 'آف',
    'field.company': 'کمپنی کا نام',
    'field.currency': 'کرنسی کا نشان',
    'field.defaultLunch': 'لنچ کی عام قیمت',
    'field.lowAlert': 'کم بیلنس الرٹ کی حد',
    'field.jazzNumber': 'جاز کیش نمبر',
    'field.accountTitle': 'اکاؤنٹ ٹائٹل',
    'field.accountNumber': 'اکاؤنٹ نمبر',
    'field.iban': 'IBAN',
    'field.branch': 'برانچ',

    'toast.saved': 'محفوظ ہو گیا',
    'toast.memberAdded': 'ممبر شامل ہو گیا',
    'toast.memberUpdated': 'ممبر اپڈیٹ ہو گیا',
    'toast.memberDeactivated': 'ممبر غیر فعال (ریکارڈ محفوظ)',
    'toast.memberDeleted': 'ممبر حذف ہو گیا',
    'toast.linkCopied': 'لنک کاپی ہو گیا',
    'toast.lunchSaved': 'لنچ محفوظ: {n} × {each} کٹوتی',
    'toast.lunchDeleted': 'لنچ حذف اور رقم واپس',
    'toast.approved': 'منظور، رسید ای میل ہو گئی',
    'toast.rejected': 'مسترد',
    'toast.deleted': 'حذف ہو گیا',
    'toast.settingsSaved': 'سیٹنگز محفوظ ہو گئیں',
    'toast.emailSent': 'ای میل بھیج دی گئی',
    'toast.emailLogged': 'SMTP سیٹ نہیں، ای میل صرف ریکارڈ ہوئی',
    'toast.emailFailed': 'ای میل ناکام: {error}',
    'toast.copyFailed': 'کاپی نہیں ہو سکا، لنک خود کاپی کریں',

    'pay.pageTitle': 'لنچ کی رقم جمع کریں',
    'pay.company': '{company} · لنچ بجٹ',
    'pay.summary': 'جمع {deposited} · خرچ {spent}',
    'pay.awaiting': ' · {amount} تصدیق کی منتظر',
    'pay.addMoney': 'رقم جمع کریں',
    'pay.wallet': 'موبائل والٹ',
    'pay.bank': 'بینک ٹرانسفر / کارڈ',
    'pay.amountPh': 'مثلاً 3000',
    'pay.payJazz': 'جاز کیش سے ادائیگی',
    'pay.payMeezan': 'میزان بینک سے ادائیگی',
    'pay.orManual': 'یا خود رقم بھیجیں',
    'pay.jazzDetails': 'اس جاز کیش اکاؤنٹ میں رقم بھیجیں:',
    'pay.meezanDetails': 'اس میزان بینک اکاؤنٹ میں رقم منتقل کریں:',
    'pay.titleLabel': 'ٹائٹل',
    'pay.accountNo': 'اکاؤنٹ نمبر',
    'pay.tid': 'جاز کیش ٹرانزیکشن آئی ڈی (TID)',
    'pay.bankRef': 'بینک ٹرانزیکشن ریفرنس / آئی ڈی',
    'pay.refPh': 'رسید پر موجود آئی ڈی درج کریں',
    'pay.sent': 'میں نے رقم بھیج دی ہے',
    'pay.note': 'ایڈمن کی تصدیق کے بعد آپ کا بیلنس اپڈیٹ ہوگا۔',
    'pay.history': 'حالیہ تاریخچہ',
    'pay.noHistory': 'ابھی کوئی ریکارڈ نہیں',
    'pay.notSetup': 'اکاؤنٹ کی تفصیل ابھی درج نہیں ہوئی۔ براہ کرم ایڈمن سے رابطہ کریں۔',
    'pay.missingToken': 'اس لنک میں ممبر کوڈ موجود نہیں۔ ایڈمن سے اپنا ذاتی لنک لیں۔',
    'pay.enterAmount': 'براہ کرم رقم درج کریں',
    'pay.thanks': 'شکریہ! آپ کی ادائیگی ایڈمن کی تصدیق کی منتظر ہے۔',
    'pay.success': 'ادائیگی کامیاب',
    'pay.failed': 'ادائیگی ناکام',
  },
};

// Messages that come from the server (errors, stored notes) keyed by their English text.
const SERVER_MESSAGES_UR = {
  'Wrong password': 'غلط پاس ورڈ',
  'Login required': 'لاگ اِن ضروری ہے',
  'Request failed': 'درخواست ناکام',
  'Something went wrong': 'کچھ غلط ہو گیا',
  'Member not found': 'ممبر نہیں ملا',
  'Transaction not found': 'ٹرانزیکشن نہیں ملی',
  'Name and email are required': 'نام اور ای میل ضروری ہیں',
  'Amount must be greater than 0': 'رقم صفر سے زیادہ ہونی چاہیے',
  'Invalid type': 'غلط قسم',
  'Date is required': 'تاریخ ضروری ہے',
  'Select at least one member': 'کم از کم ایک ممبر منتخب کریں',
  'Invalid or expired payment link': 'لنک غلط ہے یا ختم ہو چکا ہے',
  'Invalid payment method': 'غلط ادائیگی کا طریقہ',
  'Please enter the transaction ID / reference number': 'براہ کرم ٹرانزیکشن آئی ڈی / ریفرنس نمبر درج کریں',
  'JazzCash online payment is not configured': 'جاز کیش آن لائن ادائیگی سیٹ نہیں',
  'Meezan Bank online payment is not configured': 'میزان بینک آن لائن ادائیگی سیٹ نہیں',
  'Payment verification failed': 'ادائیگی کی تصدیق ناکام',
  'Payment was not completed': 'ادائیگی مکمل نہیں ہوئی',
  'Payment received via JazzCash': 'جاز کیش سے ادائیگی وصول ہو گئی',
  'Payment received via Meezan Bank': 'میزان بینک سے ادائیگی وصول ہو گئی',
  'Opening balance': 'ابتدائی بیلنس',
  'Submitted by member': 'ممبر نے جمع کروایا',
  'JazzCash online (awaiting confirmation)': 'جاز کیش آن لائن (تصدیق کی منتظر)',
  'Meezan online (awaiting confirmation)': 'میزان آن لائن (تصدیق کی منتظر)',
};

function safeGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key, value) {
  try { localStorage.setItem(key, value); } catch { /* storage unavailable */ }
}

let currentLang = I18N[safeGet('lang')] ? safeGet('lang') : 'en';

function t(key, vars = {}) {
  const text = I18N[currentLang][key] ?? I18N.en[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : `{${k}}`));
}

// Translate a message that came from the server (error text or stored note).
function tMsg(text) {
  if (!text || currentLang === 'en') return text;
  if (SERVER_MESSAGES_UR[text]) return SERVER_MESSAGES_UR[text];
  const lunch = /^Lunch (\S+)(.*)$/.exec(text);
  if (lunch) return `${t('method.lunch')} ${ltr(lunch[1])}${lunch[2]}`;
  return text;
}

// Keep numbers, dates and amounts left-to-right inside Urdu (RTL) text.
function ltr(text) {
  return `⁦${text}⁩`;
}

function getLang() {
  return currentLang;
}

function locale() {
  return currentLang === 'ur' ? 'ur-PK' : 'en-PK';
}

function applyLangAttrs() {
  document.documentElement.lang = currentLang;
  document.documentElement.dir = currentLang === 'ur' ? 'rtl' : 'ltr';
}

// Fill every [data-i18n], [data-i18n-placeholder], [data-i18n-aria] element.
function applyI18n(root = document) {
  applyLangAttrs();
  root.querySelectorAll('[data-i18n]').forEach((el) => (el.textContent = t(el.dataset.i18n)));
  root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => (el.placeholder = t(el.dataset.i18nPlaceholder)));
  root.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    el.setAttribute('aria-label', t(el.dataset.i18nAria));
    el.title = t(el.dataset.i18nAria);
  });
  const titleKey = document.documentElement.dataset.titleKey;
  if (titleKey) document.title = t(titleKey);
}

function setLang(lang) {
  if (!I18N[lang]) return;
  currentLang = lang;
  safeSet('lang', lang);
  applyI18n();
}

// ---------------- Theme ----------------

function currentTheme() {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  safeSet('theme', theme);
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.setAttribute('aria-pressed', String(theme === 'dark'));
}

// Wire the header's language select and theme toggle. onLangChange re-renders dynamic content.
function setupChrome({ onLangChange } = {}) {
  const select = document.getElementById('lang');
  if (select) {
    select.value = currentLang;
    select.onchange = () => {
      setLang(select.value);
      if (onLangChange) onLangChange();
    };
  }
  const toggle = document.getElementById('theme-toggle');
  if (toggle) {
    toggle.setAttribute('aria-pressed', String(currentTheme() === 'dark'));
    toggle.onclick = () => setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
  }
  applyI18n();
}

// Apply saved (or system) theme and language immediately to avoid a flash.
(function () {
  const saved = safeGet('theme');
  const theme = saved === 'dark' || saved === 'light'
    ? saved
    : window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = theme;
  applyLangAttrs();
})();
