/**
 * Quran Radio Stations Configuration
 * Only verified, functional, authorized streaming URLs with CORS headers and SSL/HTTPS.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.RadioStations = factory();
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const STATIONS = [
        {
            id: 'tarateel',
            name: 'إذاعة تراتيل قصيرة متميزة',
            nameEn: 'Short Quranic Recitations',
            category: 'thematic',
            categoryName: 'منوعات وتلاوات',
            streamUrl: 'https://qurango.net/radio/tarateel',
            format: 'audio/mpeg',
            bitrate: 128,
            description: 'تلاوات خاشعة ومختارة بعناية لأعذب الأصوات',
            verified: true,
            icon: 'fa-book-open-reader'
        },
        {
            id: 'alafasi',
            name: 'إذاعة مشاري راشد العفاسي',
            nameEn: 'Mishary Rashid Al-Afasy Radio',
            category: 'reciter',
            categoryName: 'قراء القرآن الكريم',
            reciterId: 'ar.alafasy',
            streamUrl: 'https://qurango.net/radio/mishary_alafasi',
            format: 'audio/mpeg',
            bitrate: 128,
            description: 'تلاوات متواصلة بصوت الشيخ مشاري بن راشد العفاسي',
            verified: true,
            icon: 'fa-microphone'
        },
        {
            id: 'abdulbasit_mojawwad',
            name: 'إذاعة عبد الباسط عبد الصمد (المجوّد)',
            nameEn: 'Abdul Basit (Mojawwad)',
            category: 'reciter',
            categoryName: 'قراء القرآن الكريم',
            reciterId: 'ar.abdulbasitmurattal',
            streamUrl: 'https://qurango.net/radio/abdulbasit_abdulsamad_mojawwad',
            format: 'audio/mpeg',
            bitrate: 128,
            description: 'تلاوات مجودة نادرة للشيخ عبد الباسط عبد الصمد رحمه الله',
            verified: true,
            icon: 'fa-microphone'
        },
        {
            id: 'abdulbasit_murattal',
            name: 'إذاعة عبد الباسط عبد الصمد (المرتّل)',
            nameEn: 'Abdul Basit (Murattal)',
            category: 'reciter',
            categoryName: 'قراء القرآن الكريم',
            reciterId: 'ar.abdulbasitmurattal',
            streamUrl: 'https://qurango.net/radio/abdulbasit_abdulsamad_warsh',
            format: 'audio/mpeg',
            bitrate: 128,
            description: 'المصحف المرتل برواية ورش عن نافع للشيخ عبد الباسط عبد الصمد',
            verified: true,
            icon: 'fa-microphone'
        },
        {
            id: 'minshawi_mojawwad',
            name: 'إذاعة محمد صديق المنشاوي (المجوّد)',
            nameEn: 'Mohamed Siddiq Al-Minshawi (Mojawwad)',
            category: 'reciter',
            categoryName: 'قراء القرآن الكريم',
            reciterId: 'ar.minshawi',
            streamUrl: 'https://qurango.net/radio/mohammed_siddiq_alminshawi_mojawwad',
            format: 'audio/mpeg',
            bitrate: 128,
            description: 'تلاوات مجودة بروح خاشعة للشيخ محمد صديق المنشاوي رحمه الله',
            verified: true,
            icon: 'fa-microphone'
        },
        {
            id: 'minshawi_murattal',
            name: 'إذاعة محمد صديق المنشاوي (المرتّل)',
            nameEn: 'Mohamed Siddiq Al-Minshawi (Murattal)',
            category: 'reciter',
            categoryName: 'قراء القرآن الكريم',
            reciterId: 'ar.minshawi',
            streamUrl: 'https://qurango.net/radio/mohammed_siddiq_alminshawi',
            format: 'audio/mpeg',
            bitrate: 128,
            description: 'المصحف المرتل كاملاً بصوت الشيخ محمد صديق المنشاوي',
            verified: true,
            icon: 'fa-microphone'
        },
        {
            id: 'hussary',
            name: 'إذاعة محمود خليل الحصري',
            nameEn: 'Mahmoud Khalil Al-Hussary',
            category: 'reciter',
            categoryName: 'قراء القرآن الكريم',
            reciterId: 'ar.husary',
            streamUrl: 'https://qurango.net/radio/mahmoud_khalil_alhussary',
            format: 'audio/mpeg',
            bitrate: 128,
            description: 'المصحف المرتل المعلم بضبط وإتقان التجويد للشيخ الحصري',
            verified: true,
            icon: 'fa-microphone'
        },
        {
            id: 'ajmy',
            name: 'إذاعة أحمد بن علي العجمي',
            nameEn: 'Ahmad Al-Ajmy',
            category: 'reciter',
            categoryName: 'قراء القرآن الكريم',
            streamUrl: 'https://qurango.net/radio/ahmad_alajmy',
            format: 'audio/mpeg',
            bitrate: 128,
            description: 'تلاوات خاشعة بصوت القارئ الشيخ أحمد بن علي العجمي',
            verified: true,
            icon: 'fa-microphone'
        },
        {
            id: 'shuraim',
            name: 'إذاعة سعود الشريم',
            nameEn: 'Saud Al-Shuraim',
            category: 'reciter',
            categoryName: 'قراء القرآن الكريم',
            streamUrl: 'https://qurango.net/radio/saud_alshuraim',
            format: 'audio/mpeg',
            bitrate: 128,
            description: 'تلاوات وإمامة الحرم المكي الشريف للشيخ سعود الشريم',
            verified: true,
            icon: 'fa-microphone'
        },
        {
            id: 'sudais',
            name: 'إذاعة عبد الرحمن السديس',
            nameEn: 'Abdurrahman As-Sudais',
            category: 'reciter',
            categoryName: 'قراء القرآن الكريم',
            reciterId: 'ar.abdurrahmaansudais',
            streamUrl: 'https://qurango.net/radio/abdulrahman_alsudaes',
            format: 'audio/mpeg',
            bitrate: 128,
            description: 'تلاوات مؤثرة من رحاب الحرم المكي الشريف بصوت الشيخ السديس',
            verified: true,
            icon: 'fa-microphone'
        },
        {
            id: 'maher',
            name: 'إذاعة ماهر المعيقلي',
            nameEn: 'Maher Al-Muaiqly',
            category: 'reciter',
            categoryName: 'قراء القرآن الكريم',
            reciterId: 'ar.mahermuaiqly',
            streamUrl: 'https://qurango.net/radio/maher_almuaiqly',
            format: 'audio/mpeg',
            bitrate: 128,
            description: 'تلاوة عطرة بصوت إمام الحرم المكي الشيخ ماهر المعيقلي',
            verified: true,
            icon: 'fa-microphone'
        },
        {
            id: 'banna',
            name: 'إذاعة محمود علي البنا',
            nameEn: 'Mahmoud Ali Al-Banna',
            category: 'reciter',
            categoryName: 'قراء القرآن الكريم',
            reciterId: 'ar.mahmoudalialbanna',
            streamUrl: 'https://qurango.net/radio/mahmoud_ali__albanna_mojawwad',
            format: 'audio/mpeg',
            bitrate: 128,
            description: 'تلاوات مجودة نادرة للشيخ محمود علي البنا رحمه الله',
            verified: true,
            icon: 'fa-microphone'
        },
        {
            id: 'dossari',
            name: 'إذاعة ياسر الدوسري',
            nameEn: 'Yasser Al-Dosari',
            category: 'reciter',
            categoryName: 'قراء القرآن الكريم',
            reciterId: 'yasser.aldossari',
            streamUrl: 'https://qurango.net/radio/yasser_aldosari',
            format: 'audio/mpeg',
            bitrate: 128,
            description: 'تلاوات مميزة من الحرم المكي للشيخ ياسر الدوسري',
            verified: true,
            icon: 'fa-microphone'
        },
        {
            id: 'khaled_jalil',
            name: 'إذاعة خالد الجليل',
            nameEn: 'Khalid Al-Jaleel',
            category: 'reciter',
            categoryName: 'قراء القرآن الكريم',
            streamUrl: 'https://qurango.net/radio/khalid_aljileel',
            format: 'audio/mpeg',
            bitrate: 128,
            description: 'تلاوات خاشعة مؤثرة للشيخ خالد الجليل',
            verified: true,
            icon: 'fa-microphone'
        },
        {
            id: 'nasser_qatami',
            name: 'إذاعة ناصر القطامي',
            nameEn: 'Nasser Al-Qatami',
            category: 'reciter',
            categoryName: 'قراء القرآن الكريم',
            streamUrl: 'https://qurango.net/radio/nasser_alqatami',
            format: 'audio/mpeg',
            bitrate: 128,
            description: 'تلاوات هادئة بصوت الشيخ ناصر القطامي',
            verified: true,
            icon: 'fa-microphone'
        },
        {
            id: 'muhammad_jibreel',
            name: 'إذاعة محمد جبريل',
            nameEn: 'Mohammed Jibreel',
            category: 'reciter',
            categoryName: 'قراء القرآن الكريم',
            streamUrl: 'https://qurango.net/radio/mohammed_jibreel',
            format: 'audio/mpeg',
            bitrate: 128,
            description: 'تلاوات وصلوات التراويح بصوت الشيخ محمد جبريل',
            verified: true,
            icon: 'fa-microphone'
        },
        {
            id: 'fares_abbad',
            name: 'إذاعة فارس عباد',
            nameEn: 'Fares Abbad',
            category: 'reciter',
            categoryName: 'قراء القرآن الكريم',
            streamUrl: 'https://qurango.net/radio/fares_abbad',
            format: 'audio/mpeg',
            bitrate: 128,
            description: 'تلاوة شجية للقرآن الكريم بصوت القارئ فارس عباد',
            verified: true,
            icon: 'fa-microphone'
        },
        {
            id: 'idrees_abkar',
            name: 'إذاعة إدريس أبكر',
            nameEn: 'Idrees Abkr',
            category: 'reciter',
            categoryName: 'قراء القرآن الكريم',
            streamUrl: 'https://qurango.net/radio/idrees_abkr',
            format: 'audio/mpeg',
            bitrate: 128,
            description: 'تلاوات خاشعة ومميزة بصوت القارئ إدريس أبكر',
            verified: true,
            icon: 'fa-microphone'
        }
    ];

    return {
        getAll() {
            return STATIONS.slice();
        },
        getById(id) {
            return STATIONS.find(s => s.id === id) || null;
        },
        getDefault() {
            return STATIONS[0];
        },
        getCategories() {
            const map = new Map();
            STATIONS.forEach(s => {
                if (!map.has(s.category)) {
                    map.set(s.category, { id: s.category, name: s.categoryName, count: 0 });
                }
                map.get(s.category).count++;
            });
            return Array.from(map.values());
        }
    };
});

