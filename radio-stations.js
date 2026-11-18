/**
 * Quran Radio Stations Configuration
 * Verified, functional, authorized HTTPS streaming URLs with fallback support.
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
            id: 'cairo_quran',
            name: 'إذاعة القرآن الكريم من القاهرة',
            nameEn: 'Holy Quran Radio Cairo',
            category: 'thematic',
            categoryName: 'البث العام والتلاوات',
            streamUrl: 'https://stream.radiojar.com/8s5u5tpdtwzuv',
            fallbackUrls: [
                'https://qurango.net/radio/mix',
                'https://backup.qurango.net/radio/mix',
                'https://qurango.net/radio/tarateel'
            ],
            format: 'audio/mpeg',
            bitrate: 128,
            description: 'البث المباشر لإذاعة القرآن الكريم من القاهرة — تلاوات كبار قراء مصر والعالم الإسلامي على مدار الساعة',
            descriptionEn: 'Live broadcast of Holy Quran Radio from Cairo — 24/7 recitations by renowned Egyptian & Islamic reciters',
            verified: true,
            icon: 'fa-tower-broadcast'
        },
        {
            id: 'general_mix',
            name: 'الإذاعة العامة للقرآن الكريم',
            nameEn: 'General Holy Quran Radio',
            category: 'thematic',
            categoryName: 'البث العام والتلاوات',
            streamUrl: 'https://qurango.net/radio/mix',
            fallbackUrls: [
                'https://backup.qurango.net/radio/mix'
            ],
            format: 'audio/mpeg',
            bitrate: 128,
            description: 'بث مباشر متواصل يجمع تلاوات متنوعة لمختلف قراء القرآن الكريم',
            descriptionEn: 'Continuous live broadcast featuring diverse recitations from various Quran reciters',
            verified: true,
            icon: 'fa-radio'
        },
        {
            id: 'tarateel',
            name: 'إذاعة تراتيل قصيرة متميزة',
            nameEn: 'Short Quranic Recitations',
            category: 'thematic',
            categoryName: 'البث العام والتلاوات',
            streamUrl: 'https://qurango.net/radio/tarateel',
            format: 'audio/mpeg',
            bitrate: 128,
            description: 'تلاوات خاشعة ومختارة بعناية لأعذب الأصوات',
            descriptionEn: 'Carefully selected short heart-touching Quranic recitations',
            verified: true,
            icon: 'fa-book-open-reader'
        },
        {
            id: 'tafsir',
            name: 'إذاعة المختصر في تفسير القرآن الكريم',
            nameEn: 'Quran Tafsir Radio',
            category: 'thematic',
            categoryName: 'البث العام والتلاوات',
            streamUrl: 'https://qurango.net/radio/mukhtasartafsir',
            format: 'audio/mpeg',
            bitrate: 128,
            description: 'تلاوة آيات القرآن الكريم مع بيان معانيها من كتاب المختصر في التفسير',
            descriptionEn: 'Quranic recitations accompanied by concise interpretation (Al-Mukhtasar fi Al-Tafsir)',
            verified: true,
            icon: 'fa-book-quran'
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
            descriptionEn: 'Rare Mojawwad recitations by Sheikh Abdul Basit Abdul Samad',
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
            description: 'المصحف المرتل للشيخ عبد الباسط عبد الصمد رحمه الله',
            descriptionEn: 'Murattal Mushaf recited by Sheikh Abdul Basit Abdul Samad',
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
            descriptionEn: 'Soulful Mojawwad recitations by Sheikh Mohamed Siddiq Al-Minshawi',
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
            descriptionEn: 'Complete Murattal Quran by Sheikh Mohamed Siddiq Al-Minshawi',
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
            descriptionEn: 'Masterful Tajweed Murattal recitation by Sheikh Mahmoud Khalil Al-Hussary',
            verified: true,
            icon: 'fa-microphone'
        },
        {
            id: 'mustafa_ismail',
            name: 'إذاعة مصطفى إسماعيل',
            nameEn: 'Mustafa Ismail',
            category: 'reciter',
            categoryName: 'قراء القرآن الكريم',
            streamUrl: 'https://qurango.net/radio/mustafa_ismail',
            format: 'audio/mpeg',
            bitrate: 128,
            description: 'تلاوات إذاعية خالدة لقارئ مصر الكبير الشيخ مصطفى إسماعيل رحمه الله',
            descriptionEn: 'Timeless broadcast recitations by the great Egyptian reciter Sheikh Mustafa Ismail',
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
            descriptionEn: 'Rare Mojawwad recitations by Sheikh Mahmoud Ali Al-Banna',
            verified: true,
            icon: 'fa-microphone'
        },
        {
            id: 'tablawi',
            name: 'إذاعة محمد محمود الطبلاوي',
            nameEn: 'Mohamed Mahmoud Al-Tablawi',
            category: 'reciter',
            categoryName: 'قراء القرآن الكريم',
            streamUrl: 'https://qurango.net/radio/mohammad_altablaway',
            format: 'audio/mpeg',
            bitrate: 128,
            description: 'تلاوات متفردة بصوت القارئ الشيخ محمد محمود الطبلاوي رحمه الله',
            descriptionEn: 'Distinctive recitations by Sheikh Mohamed Mahmoud Al-Tablawi',
            verified: true,
            icon: 'fa-microphone'
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
            descriptionEn: 'Continuous recitations by Sheikh Mishary Rashid Al-Afasy',
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
            descriptionEn: 'Heartfelt recitations by Sheikh Ahmad bin Ali Al-Ajmy',
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
            descriptionEn: 'Makkah Haram recitations by Sheikh Saud Al-Shuraim',
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
            descriptionEn: 'Moving recitations from the Grand Mosque in Makkah by Sheikh As-Sudais',
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
            descriptionEn: 'Serene recitations by Makkah Haram Imam Sheikh Maher Al-Muaiqly',
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
            descriptionEn: 'Distinguished Makkah Haram recitations by Sheikh Yasser Al-Dosari',
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
            descriptionEn: 'Deeply moving recitations by Sheikh Khalid Al-Jaleel',
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
            descriptionEn: 'Calm and reverent recitations by Sheikh Nasser Al-Qatami',
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
            descriptionEn: 'Recitations and Taraweeh prayers by Sheikh Mohammed Jibreel',
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
            descriptionEn: 'Melodious Quranic recitation by Sheikh Fares Abbad',
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
            descriptionEn: 'Soulful and distinctive recitations by Sheikh Idrees Abkr',
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
