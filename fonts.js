/**
 * fonts.js
 * Arabic Type Extension — Font Library Definitions
 *
 * Loaded as a content script (document_start and document_idle).
 * Exposes window.ARABIC_FONTS — an array of font descriptor objects.
 *
 * Each object describes one curated Arabic web font available through
 * Google Fonts. The popup uses this data to render the font picker;
 * content scripts use it to build @import URLs and CSS font-family rules.
 *
 * IMPORTANT: previewText values are hardcoded Arabic strings intentionally.
 * They are content data, not UI strings, and are not passed through i18n.
 * Font proper names (Cairo, Amiri, etc.) are not translated.
 */

(function () {
  'use strict';

  /** @type {Array<{
   *   id: string,
   *   nameKey: string,
   *   descriptionKey: string,
   *   scriptStyle: string,
   *   scriptStyleKey: string,
   *   bestFor: string[],
   *   bestForKey: string,
   *   googleFontName: string,
   *   googleFontWeights: string,
   *   cssFamily: string,
   *   supportsUrdu: boolean,
   *   supportsFarsi: boolean,
   *   previewText: string
   * }>} */
  var ARABIC_FONTS = [
    {
      id: 'cairo',
      nameKey: 'fontNameCairo',
      descriptionKey: 'fontDescCairo',
      scriptStyle: 'modern',
      scriptStyleKey: 'scriptStyleModern',
      bestFor: ['ui', 'headlines', 'body'],
      bestForKey: 'bestForUiHeadlinesBody',
      googleFontName: 'Cairo',
      googleFontWeights: '400;500;600;700',
      cssFamily: "'Cairo', 'Arial', sans-serif",
      supportsUrdu: false,
      supportsFarsi: false,
      previewText: '\u0627\u0644\u062E\u0637 \u0627\u0644\u0639\u0631\u0628\u064A \u0627\u0644\u062C\u0645\u064A\u0644'
      // "الخط العربي الجميل"
    },
    {
      id: 'amiri',
      nameKey: 'fontNameAmiri',
      descriptionKey: 'fontDescAmiri',
      scriptStyle: 'naskh',
      scriptStyleKey: 'scriptStyleNaskh',
      bestFor: ['body', 'quran'],
      bestForKey: 'bestForBodyQuran',
      googleFontName: 'Amiri',
      googleFontWeights: '400;700',
      cssFamily: "'Amiri', 'Times New Roman', serif",
      supportsUrdu: true,
      supportsFarsi: true,
      previewText: '\u0628\u0650\u0633\u0652\u0645\u0650 \u0627\u0644\u0644\u0651\u064E\u0647\u0650 \u0627\u0644\u0631\u0651\u064E\u062D\u0652\u0645\u064E\u0646\u0650 \u0627\u0644\u0631\u0651\u064E\u062D\u0650\u064A\u0645\u0650'
      // "بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ"
    },
    {
      id: 'tajawal',
      nameKey: 'fontNameTajawal',
      descriptionKey: 'fontDescTajawal',
      scriptStyle: 'modern',
      scriptStyleKey: 'scriptStyleModern',
      bestFor: ['ui', 'body'],
      bestForKey: 'bestForUiBody',
      googleFontName: 'Tajawal',
      googleFontWeights: '400;500;700',
      cssFamily: "'Tajawal', 'Arial', sans-serif",
      supportsUrdu: false,
      supportsFarsi: false,
      previewText: '\u0646\u0635 \u0639\u0631\u0628\u064A \u0648\u0627\u0636\u062D \u0648\u062C\u0645\u064A\u0644'
      // "نص عربي واضح وجميل"
    },
    {
      id: 'noto_naskh',
      nameKey: 'fontNameNotoNaskh',
      descriptionKey: 'fontDescNotoNaskh',
      scriptStyle: 'naskh',
      scriptStyleKey: 'scriptStyleNaskh',
      bestFor: ['body', 'quran'],
      bestForKey: 'bestForBodyQuran',
      googleFontName: 'Noto Naskh Arabic',
      googleFontWeights: '400;500;600;700',
      cssFamily: "'Noto Naskh Arabic', 'Arial', sans-serif",
      supportsUrdu: true,
      supportsFarsi: true,
      previewText: '\u0627\u0644\u062E\u0637 \u0627\u0644\u0646\u0627\u0633\u062E \u0627\u0644\u0648\u0627\u0636\u062D'
      // "الخط الناسخ الواضح"
    },
    {
      id: 'noto_kufi',
      nameKey: 'fontNameNotoKufi',
      descriptionKey: 'fontDescNotoKufi',
      scriptStyle: 'kufi',
      scriptStyleKey: 'scriptStyleKufi',
      bestFor: ['headlines', 'display'],
      bestForKey: 'bestForHeadlinesDisplay',
      googleFontName: 'Noto Kufi Arabic',
      googleFontWeights: '400;700',
      cssFamily: "'Noto Kufi Arabic', 'Arial', sans-serif",
      supportsUrdu: false,
      supportsFarsi: false,
      previewText: '\u0627\u0644\u062E\u0637 \u0627\u0644\u0643\u0648\u0641\u064A \u0627\u0644\u0623\u0635\u064A\u0644'
      // "الخط الكوفي الأصيل"
    },
    {
      id: 'reem_kufi',
      nameKey: 'fontNameReemKufi',
      descriptionKey: 'fontDescReemKufi',
      scriptStyle: 'kufi',
      scriptStyleKey: 'scriptStyleKufi',
      bestFor: ['headlines', 'display'],
      bestForKey: 'bestForHeadlinesDisplay',
      googleFontName: 'Reem Kufi',
      googleFontWeights: '400;500;600;700',
      cssFamily: "'Reem Kufi', 'Arial', sans-serif",
      supportsUrdu: false,
      supportsFarsi: false,
      previewText: '\u062E\u0637 \u0631\u064A\u0645 \u0627\u0644\u0643\u0648\u0641\u064A'
      // "خط ريم الكوفي"
    },
    {
      id: 'scheherazade',
      nameKey: 'fontNameScheherazade',
      descriptionKey: 'fontDescScheherazade',
      scriptStyle: 'naskh',
      scriptStyleKey: 'scriptStyleNaskh',
      bestFor: ['body', 'quran'],
      bestForKey: 'bestForBodyQuran',
      googleFontName: 'Scheherazade New',
      googleFontWeights: '400;700',
      cssFamily: "'Scheherazade New', serif",
      supportsUrdu: true,
      supportsFarsi: true,
      previewText: '\u062E\u0637 \u0634\u0647\u0631\u0632\u0627\u062F \u0627\u0644\u0643\u0644\u0627\u0633\u064A\u0643\u064A'
      // "خط شهرزاد الكلاسيكي"
    },
    {
      id: 'lateef',
      nameKey: 'fontNameLateef',
      descriptionKey: 'fontDescLateef',
      scriptStyle: 'nastaliq',
      scriptStyleKey: 'scriptStyleNastaliq',
      bestFor: ['body'],
      bestForKey: 'bestForBody',
      googleFontName: 'Lateef',
      googleFontWeights: '400',
      cssFamily: "'Lateef', serif",
      supportsUrdu: true,
      supportsFarsi: true,
      previewText: '\u062E\u0637 \u0644\u0637\u064A\u0641 \u0627\u0644\u0646\u0633\u062A\u0639\u0644\u06CC\u0642'
      // "خط لطيف النستعليق"
    },
    {
      id: 'harmattan',
      nameKey: 'fontNameHarmattan',
      descriptionKey: 'fontDescHarmattan',
      scriptStyle: 'modern',
      scriptStyleKey: 'scriptStyleModern',
      bestFor: ['ui', 'body'],
      bestForKey: 'bestForUiBody',
      googleFontName: 'Harmattan',
      googleFontWeights: '400;700',
      cssFamily: "'Harmattan', 'Arial', sans-serif",
      supportsUrdu: false,
      supportsFarsi: false,
      previewText: '\u062E\u0637 \u0647\u0631\u0645\u062A\u0627\u0646 \u0627\u0644\u062D\u062F\u064A\u062B'
      // "خط هرمتان الحديث"
    },
    {
      id: 'mada',
      nameKey: 'fontNameMada',
      descriptionKey: 'fontDescMada',
      scriptStyle: 'modern',
      scriptStyleKey: 'scriptStyleModern',
      bestFor: ['ui', 'headlines'],
      bestForKey: 'bestForUiHeadlines',
      googleFontName: 'Mada',
      googleFontWeights: '400;500;600;700',
      cssFamily: "'Mada', 'Arial', sans-serif",
      supportsUrdu: false,
      supportsFarsi: false,
      previewText: '\u062E\u0637 \u0645\u062F\u0649 \u0627\u0644\u0639\u0635\u0631\u064A'
      // "خط مدى العصري"
    },
    {
      id: 'el_messiri',
      nameKey: 'fontNameElMessiri',
      descriptionKey: 'fontDescElMessiri',
      scriptStyle: 'modern',
      scriptStyleKey: 'scriptStyleModern',
      bestFor: ['headlines', 'display'],
      bestForKey: 'bestForHeadlinesDisplay',
      googleFontName: 'El Messiri',
      googleFontWeights: '400;500;600;700',
      cssFamily: "'El Messiri', 'Arial', sans-serif",
      supportsUrdu: false,
      supportsFarsi: false,
      previewText: '\u062E\u0637 \u0627\u0644\u0645\u0633\u064A\u0631\u064A \u0644\u0644\u0639\u0646\u0627\u0648\u064A\u0646'
      // "خط المسيري للعناوين"
    },
    {
      id: 'ibm_plex_arabic',
      nameKey: 'fontNameIbmPlexArabic',
      descriptionKey: 'fontDescIbmPlexArabic',
      scriptStyle: 'modern',
      scriptStyleKey: 'scriptStyleModern',
      bestFor: ['ui', 'body', 'headlines'],
      bestForKey: 'bestForUiHeadlinesBody',
      googleFontName: 'IBM Plex Sans Arabic',
      googleFontWeights: '400;500;600;700',
      cssFamily: "'IBM Plex Sans Arabic', 'Arial', sans-serif",
      supportsUrdu: false,
      supportsFarsi: false,
      previewText: '\u062E\u0637 IBM \u0628\u0644\u0643\u0633 \u0627\u0644\u0639\u0631\u0628\u064A'
      // "خط IBM بلكس العربي"
    }
  ];

  // Expose globally — consumed by both content-early.js and content.js
  // and by popup.js (which imports fonts.js separately via its own <script>).
  window.ARABIC_FONTS = ARABIC_FONTS;

  /**
   * Build a Google Fonts URL for a given font descriptor.
   * @param {object} font - A font object from ARABIC_FONTS.
   * @returns {string} The full Google Fonts stylesheet URL.
   */
  window.AT_buildFontUrl = function (font) {
    var name = font.googleFontName.replace(/ /g, '+');
    var weights = font.googleFontWeights.replace(/;/g, ';');
    return (
      'https://fonts.googleapis.com/css2?family=' +
      name +
      ':wght@' +
      weights +
      '&subset=arabic&display=swap'
    );
  };

  /**
   * Return a font descriptor by id.
   * @param {string} id
   * @returns {object|undefined}
   */
  window.AT_getFontById = function (id) {
    for (var i = 0; i < ARABIC_FONTS.length; i++) {
      if (ARABIC_FONTS[i].id === id) return ARABIC_FONTS[i];
    }
    return undefined;
  };
})();
