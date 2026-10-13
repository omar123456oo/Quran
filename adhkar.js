/**
 * Adhkar (Islamic Remembrances) Module
 * أذكار المسلم - Remembrances for Muslims
 */

const Adhkar = {
    currentCategory: 'morning',
    
    // قاعدة بيانات الأذكار
    adhkarData: {
        morning: {
            name: 'أذكار الصباح',
            nameEn: 'Morning Remembrances',
            icon: 'fa-sun',
            color: '#f093fb',
            adhkar: [
                {
                    text: 'أَعُوذُ بِاللهِ مِنْ الشَّيْطَانِ الرَّجِيمِ\nاللّهُ لاَ إِلَـهَ إِلاَّ هُوَ الْحَيُّ الْقَيُّومُ لاَ تَأْخُذُهُ سِنَةٌ وَلاَ نَوْمٌ لَّهُ مَا فِي السَّمَاوَاتِ وَمَا فِي الأَرْضِ مَن ذَا الَّذِي يَشْفَعُ عِنْدَهُ إِلاَّ بِإِذْنِهِ يَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْ وَلاَ يُحِيطُونَ بِشَيْءٍ مِّنْ عِلْمِهِ إِلاَّ بِمَا شَاء وَسِعَ كُرْسِيُّهُ السَّمَاوَاتِ وَالأَرْضَ وَلاَ يَؤُودُهُ حِفْظُهُمَا وَهُوَ الْعَلِيُّ الْعَظِيمُ',
                    translation: 'آية الكرسي',
                    count: 1,
                    benefit: 'من قالها حين يصبح أجير من الجن حتى يمسي'
                },
                {
                    text: 'بِسْمِ اللهِ الَّذِي لاَ يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الأَرْضِ وَلاَ فِي السَّمَاءِ وَهُوَ السَّمِيعُ الْعَلِيمُ',
                    translation: 'بسم الله الذي لا يضر مع اسمه شيء',
                    count: 3,
                    benefit: 'من قالها ثلاثاً لم تصبه فجأة بلاء حتى يمسي'
                },
                {
                    text: 'رَضِيتُ بِاللهِ رَبًّا، وَبِالإِسْلاَمِ دِينًا، وَبِمُحَمَّدٍ صَلَى اللهُ عَلِيْهِ وَسَلَّمَ نَبِيًّا',
                    translation: 'رضيت بالله رباً',
                    count: 3,
                    benefit: 'من قالها حين يصبح وحين يمسي كان حقاً على الله أن يرضيه يوم القيامة'
                },
                {
                    text: 'سُبْحَانَ اللهِ وَبِحَمْدِهِ عَدَدَ خَلْقِهِ، وَرِضَا نَفْسِهِ، وَزِنَةَ عَرْشِهِ، وَمِدَادَ كَلِمَاتِهِ',
                    translation: 'سبحان الله وبحمده',
                    count: 3,
                    benefit: 'أجر عظيم وثواب كبير'
                },
                {
                    text: 'اللَّهُمَّ إِنِّي أَصْبَحْتُ أُشْهِدُكَ، وَأُشْهِدُ حَمَلَةَ عَرْشِكَ، وَمَلاَئِكَتَكَ، وَجَمِيعَ خَلْقِكَ، أَنَّكَ أَنْتَ اللهُ لاَ إِلَهَ إِلاَّ أَنْتَ وَحْدَكَ لاَ شَرِيكَ لَكَ، وَأَنَّ مُحَمَّدًا عَبْدُكَ وَرَسُولُكَ',
                    translation: 'اللهم إني أصبحت أشهدك',
                    count: 4,
                    benefit: 'من قالها أعتق الله ربعه من النار، فإن قالها أربعاً أعتق الله نصفه'
                },
                {
                    text: 'اللَّهُمَّ مَا أَصْبَحَ بِي مِنْ نِعْمَةٍ أَوْ بِأَحَدٍ مِنْ خَلْقِكَ فَمِنْكَ وَحْدَكَ لاَ شَرِيكَ لَكَ، فَلَكَ الْحَمْدُ وَلَكَ الشُّكْرُ',
                    translation: 'اللهم ما أصبح بي من نعمة',
                    count: 1,
                    benefit: 'من قالها فقد أدى شكر يومه'
                },
                {
                    text: 'اللَّهُمَّ عَافِنِي فِي بَدَنِي، اللَّهُمَّ عَافِنِي فِي سَمْعِي، اللَّهُمَّ عَافِنِي فِي بَصَرِي، لاَ إِلَهَ إِلاَّ أَنْتَ',
                    translation: 'اللهم عافني في بدني',
                    count: 3,
                    benefit: 'الدعاء بالعافية'
                },
                {
                    text: 'حَسْبِيَ اللهُ لاَ إِلَهَ إِلاَّ هُوَ عَلَيْهِ تَوَكَّلْتُ وَهُوَ رَبُّ الْعَرْشِ الْعَظِيمِ',
                    translation: 'حسبي الله',
                    count: 7,
                    benefit: 'من قالها حين يصبح وحين يمسي كفاه الله ما أهمه'
                },
                {
                    text: 'أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ للهِ، وَالْحَمْدُ للهِ، لاَ إِلَهَ إِلاَّ اللهُ وَحْدَهُ لاَ شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ، رَبِّ أَسْأَلُكَ خَيْرَ مَا فِي هَذَا الْيَوْمِ وَخَيْرَ مَا بَعْدَهُ، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِي هَذَا الْيَوْمِ وَشَرِّ مَا بَعْدَهُ',
                    translation: 'أصبحنا وأصبح الملك لله',
                    count: 1,
                    benefit: 'دعاء شامل للخير والحفظ'
                }
            ]
        },
        evening: {
            name: 'أذكار المساء',
            nameEn: 'Evening Remembrances',
            icon: 'fa-moon',
            color: '#667eea',
            adhkar: [
                {
                    text: 'أَعُوذُ بِاللهِ مِنْ الشَّيْطَانِ الرَّجِيمِ\nاللّهُ لاَ إِلَـهَ إِلاَّ هُوَ الْحَيُّ الْقَيُّومُ لاَ تَأْخُذُهُ سِنَةٌ وَلاَ نَوْمٌ لَّهُ مَا فِي السَّمَاوَاتِ وَمَا فِي الأَرْضِ مَن ذَا الَّذِي يَشْفَعُ عِنْدَهُ إِلاَّ بِإِذْنِهِ يَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْ وَلاَ يُحِيطُونَ بِشَيْءٍ مِّنْ عِلْمِهِ إِلاَّ بِمَا شَاء وَسِعَ كُرْسِيُّهُ السَّمَاوَاتِ وَالأَرْضَ وَلاَ يَؤُودُهُ حِفْظُهُمَا وَهُوَ الْعَلِيُّ الْعَظِيمُ',
                    translation: 'آية الكرسي',
                    count: 1,
                    benefit: 'من قالها حين يمسي أجير من الجن حتى يصبح'
                },
                {
                    text: 'بِسْمِ اللهِ الَّذِي لاَ يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الأَرْضِ وَلاَ فِي السَّمَاءِ وَهُوَ السَّمِيعُ الْعَلِيمُ',
                    translation: 'بسم الله الذي لا يضر مع اسمه شيء',
                    count: 3,
                    benefit: 'من قالها ثلاثاً لم تصبه فجأة بلاء حتى يصبح'
                },
                {
                    text: 'أَمْسَيْنَا وَأَمْسَى الْمُلْكُ للهِ، وَالْحَمْدُ للهِ، لاَ إِلَهَ إِلاَّ اللهُ وَحْدَهُ لاَ شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ، رَبِّ أَسْأَلُكَ خَيْرَ مَا فِي هَذِهِ اللَّيْلَةِ وَخَيْرَ مَا بَعْدَهَا، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِي هَذِهِ اللَّيْلَةِ وَشَرِّ مَا بَعْدَهَا',
                    translation: 'أمسينا وأمسى الملك لله',
                    count: 1,
                    benefit: 'دعاء شامل للخير والحفظ'
                }
            ]
        },
        sleep: {
            name: 'أذكار النوم',
            nameEn: 'Before Sleep',
            icon: 'fa-bed',
            color: '#4facfe',
            adhkar: [
                {
                    text: 'بِاسْمِكَ رَبِّي وَضَعْتُ جَنْبِي، وَبِكَ أَرْفَعُهُ، فَإِنْ أَمْسَكْتَ نَفْسِي فَارْحَمْهَا، وَإِنْ أَرْسَلْتَهَا فَاحْفَظْهَا بِمَا تَحْفَظُ بِهِ عِبَادَكَ الصَّالِحِينَ',
                    translation: 'دعاء النوم',
                    count: 1,
                    benefit: 'الاستعانة بالله عند النوم'
                },
                {
                    text: 'اللَّهُمَّ إِنَّكَ خَلَقْتَ نَفْسِي وَأَنْتَ تَوَفَّاهَا، لَكَ مَمَاتُهَا وَمَحْيَاهَا، إِنْ أَحْيَيْتَهَا فَاحْفَظْهَا، وَإِنْ أَمَتَّهَا فَاغْفِرْ لَهَا، اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَافِيَةَ',
                    translation: 'اللهم إنك خلقت نفسي',
                    count: 1,
                    benefit: 'طلب العافية والمغفرة'
                },
                {
                    text: 'قُلْ هُوَ اللَّهُ أَحَدٌ، اللَّهُ الصَّمَدُ، لَمْ يَلِدْ وَلَمْ يُولَدْ، وَلَمْ يَكُن لَّهُ كُفُوًا أَحَدٌ',
                    translation: 'سورة الإخلاص',
                    count: 3,
                    benefit: 'قراءة المعوذات قبل النوم'
                }
            ]
        },
        prayer: {
            name: 'أذكار الصلاة',
            nameEn: 'After Prayer',
            icon: 'fa-praying-hands',
            color: '#f5576c',
            adhkar: [
                {
                    text: 'أَسْتَغْفِرُ اللهَ (ثلاثاً)\nاللَّهُمَّ أَنْتَ السَّلاَمُ، وَمِنْكَ السَّلاَمُ، تَبَارَكْتَ يَا ذَا الْجَلاَلِ وَالإِكْرَامِ',
                    translation: 'الاستغفار بعد الصلاة',
                    count: 1,
                    benefit: 'مغفرة الذنوب'
                },
                {
                    text: 'لاَ إِلَهَ إِلاَّ اللهُ وَحْدَهُ لاَ شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ',
                    translation: 'التوحيد بعد الصلاة',
                    count: 1,
                    benefit: 'محو الذنوب'
                },
                {
                    text: 'سُبْحَانَ اللهِ (33)\nالْحَمْدُ للهِ (33)\nاللهُ أَكْبَرُ (33)',
                    translation: 'التسبيح بعد الصلاة',
                    count: 1,
                    benefit: 'حط الخطايا'
                }
            ]
        },
        general: {
            name: 'أذكار متنوعة',
            nameEn: 'General Remembrances',
            icon: 'fa-star',
            color: '#ffa726',
            adhkar: [
                {
                    text: 'سُبْحَانَ اللهِ وَبِحَمْدِهِ',
                    translation: 'التسبيح',
                    count: 100,
                    benefit: 'من قالها مائة مرة حطت خطاياه وإن كانت مثل زبد البحر'
                },
                {
                    text: 'لاَ إِلَهَ إِلاَّ اللهُ وَحْدَهُ لاَ شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ',
                    translation: 'التهليل',
                    count: 10,
                    benefit: 'من قالها عشر مرات كان كمن أعتق أربعة أنفس من ولد إسماعيل'
                },
                {
                    text: 'أَسْتَغْفِرُ اللهَ وَأَتُوبُ إِلَيْهِ',
                    translation: 'الاستغفار',
                    count: 100,
                    benefit: 'المداومة على الاستغفار'
                }
            ]
        }
    },

    /**
     * تهيئة قسم الأذكار
     */
    init() {
        console.log('Initializing Adhkar Module...');
        this.loadAdhkar('morning');
    },

    /**
     * تحميل فئة معينة من الأذكار
     */
    loadAdhkar(category) {
        this.currentCategory = category;
        const data = this.adhkarData[category];
        
        if (!data) return;

        const container = document.getElementById('adhkarContent');
        if (!container) return;

        let html = `
            <div class="page-header text-center mb-4">
                <h1 style="color: ${data.color};">
                    <i class="fas ${data.icon}"></i>
                    ${data.name}
                </h1>
                <p class="text-lg" style="color: var(--color-text-gray);">${data.nameEn}</p>
            </div>

            <div class="adhkar-grid">
        `;

        data.adhkar.forEach((dhikr, index) => {
            html += this.createDhikrCard(dhikr, index, data.color);
        });

        html += '</div>';
        container.innerHTML = html;

        // إضافة مستمع لأزرار العد
        this.setupCounterButtons();
    },

    /**
     * إنشاء بطاقة ذكر
     */
    createDhikrCard(dhikr, index, color) {
        const counterId = `counter-${this.currentCategory}-${index}`;
        
        return `
            <div class="card dhikr-card" style="border-top: 4px solid ${color};">
                <div class="arabic-text" style="font-size: var(--text-xl); line-height: 2.2; margin-bottom: 20px; white-space: pre-line;">
                    ${dhikr.text}
                </div>

                ${dhikr.translation ? `
                    <div class="dhikr-translation" style="color: var(--color-text-gray); margin-bottom: 15px; padding: 10px; background: var(--color-bg-light); border-radius: var(--radius-md);">
                        <i class="fas fa-info-circle"></i> ${dhikr.translation}
                    </div>
                ` : ''}

                ${dhikr.benefit ? `
                    <div class="dhikr-benefit" style="color: var(--color-accent); margin-bottom: 15px; padding: 10px; background: var(--color-bg-light); border-radius: var(--radius-md); font-size: 14px;">
                        <i class="fas fa-gift"></i> ${dhikr.benefit}
                    </div>
                ` : ''}

                <div class="dhikr-counter" style="display: flex; align-items: center; justify-content: center; gap: 15px; margin-top: 20px;">
                    <button class="btn btn-icon counter-reset" data-counter="${counterId}" title="إعادة تعيين">
                        <i class="fas fa-redo"></i>
                    </button>
                    
                    <div style="text-align: center;">
                        <div id="${counterId}" class="counter-display" style="font-size: 32px; font-weight: bold; color: ${color}; min-width: 60px;">
                            0
                        </div>
                        <div style="font-size: 12px; color: var(--color-text-gray);">
                            من ${dhikr.count}
                        </div>
                    </div>

                    <button class="btn btn-primary counter-increment" data-counter="${counterId}" data-max="${dhikr.count}" style="min-width: 120px;">
                        <i class="fas fa-plus"></i> عَدّ
                    </button>
                </div>

                <div id="${counterId}-complete" class="dhikr-complete" style="display: none; text-align: center; margin-top: 15px; padding: 10px; background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: white; border-radius: var(--radius-md); animation: fadeIn 0.5s;">
                    <i class="fas fa-check-circle"></i> تم بحمد الله
                </div>
            </div>
        `;
    },

    /**
     * إعداد أزرار العداد
     */
    setupCounterButtons() {
        // أزرار الزيادة
        document.querySelectorAll('.counter-increment').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const counterId = e.target.closest('button').dataset.counter;
                const max = parseInt(e.target.closest('button').dataset.max);
                const counterEl = document.getElementById(counterId);
                const completeEl = document.getElementById(`${counterId}-complete`);
                
                let current = parseInt(counterEl.textContent);
                
                if (current < max) {
                    current++;
                    counterEl.textContent = current;
                    
                    // إضافة تأثير
                    counterEl.style.transform = 'scale(1.2)';
                    setTimeout(() => {
                        counterEl.style.transform = 'scale(1)';
                    }, 200);
                    
                    // عرض رسالة الإكمال
                    if (current === max) {
                        completeEl.style.display = 'block';
                        // تشغيل صوت أو اهتزاز
                        if (navigator.vibrate) {
                            navigator.vibrate(200);
                        }
                    }
                }
            });
        });

        // أزرار إعادة التعيين
        document.querySelectorAll('.counter-reset').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const counterId = e.target.closest('button').dataset.counter;
                const counterEl = document.getElementById(counterId);
                const completeEl = document.getElementById(`${counterId}-complete`);
                
                counterEl.textContent = '0';
                completeEl.style.display = 'none';
            });
        });
    }
};

window.Adhkar = Adhkar;
