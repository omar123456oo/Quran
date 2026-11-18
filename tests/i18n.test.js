const test = require('node:test');
const assert = require('node:assert/strict');
const I18n = require('../i18n.js');

test('i18n: default language is Arabic and provides Arabic translations', () => {
    I18n.init('ar');
    assert.equal(I18n.getLanguage(), 'ar');
    assert.equal(I18n.isRTL(), true);
    assert.equal(I18n.t('logo'), 'القرآن الكريم');
    assert.equal(I18n.t('nav.home'), 'الرئيسية');
    assert.equal(I18n.t('nav.radio'), 'الإذاعة');
    assert.equal(I18n.t('lang_label'), 'EN');
});

test('i18n: toggleLanguage switches between Arabic and English', () => {
    I18n.init('ar');
    assert.equal(I18n.getLanguage(), 'ar');

    I18n.toggleLanguage();
    assert.equal(I18n.getLanguage(), 'en');
    assert.equal(I18n.isRTL(), false);
    assert.equal(I18n.t('logo'), 'Holy Quran');
    assert.equal(I18n.t('nav.home'), 'Home');
    assert.equal(I18n.t('nav.radio'), 'Radio');
    assert.equal(I18n.t('lang_label'), 'عربي');

    I18n.toggleLanguage();
    assert.equal(I18n.getLanguage(), 'ar');
    assert.equal(I18n.isRTL(), true);
    assert.equal(I18n.t('nav.home'), 'الرئيسية');
});

test('i18n: handles missing keys gracefully with fallback', () => {
    assert.equal(I18n.t('non.existent.key', 'Fallback Value'), 'Fallback Value');
});

