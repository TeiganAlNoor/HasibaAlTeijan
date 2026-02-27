// ========================================
// TEIJAN - Premium Educational Platform
// JavaScript Controller
// ========================================

// ===== SECTION NAVIGATION =====
function switchSection(sectionName) {
  // Remove active class from all tabs and sections
  document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.content-section').forEach(section => section.classList.remove('active'));

  // Add active class to clicked tab and corresponding section
  document.querySelector('[data-section="' + sectionName + '"]').classList.add('active');
  document.getElementById(sectionName + '-section').classList.add('active');

  // Clear results when switching sections
  document.getElementById('result-content').innerHTML = '';

  // Load default content for each section
  if (sectionName === 'review') {
    showReviewCalculator();
  } else if (sectionName === 'testing') {
    showTestType('monthly');
  } else if (sectionName === 'consolidation') {
    showConsolidationCalculator();
  } else if (sectionName === 'quiz') {
    showQuizCalculator();
  }
}

// ===== REVIEW SECTION (95% passing) =====
// Track current review sub-type
var currentReviewSubType = 'save';

function showReviewCalculator() {
  showReviewSubType('save');
}

function showReviewSubType(subType) {
  currentReviewSubType = subType;

  // Update sub-nav buttons
  document.querySelectorAll('#review-section .sub-nav-btn').forEach(function (btn) {
    btn.classList.remove('active');
  });
  if (event && event.target) {
    event.target.classList.add('active');
  } else {
    document.querySelector('#review-section .sub-nav-btn').classList.add('active');
  }

  var rowCount = subType === 'save' ? 3 : 4;
  var calcTitle = subType === 'save' ? 'حاسبة حفظ للمراجعة' : 'حاسبة التثبيت';

  var rows = '';
  for (var i = 0; i < rowCount; i++) {
    rows += '<tr>' +
      '<td>' + (i + 1) + '</td>' +
      '<td><input type="number" class="corrections" min="0" oninput="validateInput(this)"></td>' +
      '<td><input type="number" class="word-openings" min="0" oninput="validateInput(this)"></td>' +
      '<td><input type="number" class="verse-openings" min="0" oninput="validateInput(this)"></td>' +
      '<td><input type="number" class="memorized-with-recitation" min="0" oninput="validateInput(this)"></td>' +
      '<td><input type="number" class="memorized-no-recitation" min="0" oninput="validateInput(this)"></td>' +
      '<td><span class="result">0</span></td>' +
      '</tr>';
  }

  var content = '<h3 class="calculator-title">' + calcTitle + '</h3>' +
    '<div class="table-container">' +
    '<table class="calculator-table">' +
    '<thead>' +
    '<tr>' +
    '<th>#</th>' +
    '<th>عدد تصحيح الحركات</th>' +
    '<th>عدد فتح الكلمات</th>' +
    '<th>عدد فتح الآيات</th>' +
    '<th>عدد التأتأة مع تنبيه</th>' +
    '<th>عدد التأتأة بدون تنبيه</th>' +
    '<th>النتيجة</th>' +
    '</tr>' +
    '</thead>' +
    '<tbody>' + rows + '</tbody>' +
    '</table>' +
    '</div>' +
    '<div class="button-container">' +
    '<button class="main-calculate-btn" onclick="calculateReviewResults()">احسب النتائج</button>' +
    '</div>';

  document.getElementById('review-content').innerHTML = content;
  document.getElementById('result-content').innerHTML = '';
}

function calculateReviewResults() {
  var totalResult = 0;

  document.querySelectorAll('#review-content tbody tr').forEach(function (row) {
    var corrections = parseInt(row.querySelector('.corrections').value) || 0;
    var wordOpenings = parseInt(row.querySelector('.word-openings').value) || 0;
    var verseOpenings = parseInt(row.querySelector('.verse-openings').value) || 0;
    var memorizedNoRecitation = parseInt(row.querySelector('.memorized-no-recitation').value) || 0;
    var memorizedWithRecitation = parseInt(row.querySelector('.memorized-with-recitation').value) || 0;

    var result = corrections * 2 + wordOpenings * 1 + verseOpenings * 2 + memorizedNoRecitation * 0.1 + memorizedWithRecitation * 0.5;

    row.querySelector('.result').textContent = -result.toFixed(1);
    totalResult += result;
  });

  totalResult = 100 - totalResult;

  // Determine grade based on score
  var grade = '';
  var emoji = '';
  var statusClass = '';

  if (totalResult >= 99) {
    grade = 'امتياز';
    emoji = '🥳';
    statusClass = 'result-pass';
  } else if (totalResult >= 97) {
    grade = 'ممتاز';
    emoji = '😎';
    statusClass = 'result-pass';
  } else if (totalResult >= 95) {
    grade = 'جيد جداً';
    emoji = '😁';
    statusClass = 'result-pass';
  } else {
    grade = 'غير مكتمل';
    emoji = '❌';
    statusClass = 'result-incomplete';
  }

  var date = new Date().toLocaleDateString('ar-EG');
  var subTypeName = currentReviewSubType === 'save' ? 'حفظ للمراجعة' : 'التثبيت';

  var resultContent = '<table class="result-table">' +
    '<tbody>' +
    '<tr>' +
    '<td>نوع التقييم</td>' +
    '<td>اتصال المراجعة التراكميّ - ' + subTypeName + '</td>' +
    '</tr>' +
    '<tr>' +
    '<td>النتيجة</td>' +
    '<td><span id="total-result" class="' + statusClass + '">' + totalResult.toFixed(1) + ' ' + emoji + ' ' + grade + '</span></td>' +
    '</tr>' +
    '<tr>' +
    '<td>التقدير</td>' +
    '<td>' + grade + '</td>' +
    '</tr>' +
    '<tr>' +
    '<td>التاريخ</td>' +
    '<td>' + date + '</td>' +
    '</tr>' +
    '</tbody>' +
    '</table>';

  document.getElementById('result-content').innerHTML = resultContent;

  if (totalResult >= 95) {
    showConfetti();
  }
}

// ===== TESTING SECTION (Monthly and Cumulative) =====
function showTestType(type) {
  // Update sub-nav buttons
  document.querySelectorAll('#testing-section .sub-nav-btn').forEach(function (btn) {
    btn.classList.remove('active');
  });
  if (event && event.target) {
    event.target.classList.add('active');
  } else {
    document.querySelector('#testing-section .sub-nav-btn').classList.add('active');
  }

  var rowCount = type === 'monthly' ? 5 : 7;
  var testName = type === 'monthly' ? 'الاختبار الشهري' : 'الاختبار التراكمي';

  var rows = '';
  for (var i = 0; i < rowCount; i++) {
    rows += '<tr>' +
      '<td>' + (i + 1) + '</td>' +
      '<td><input type="number" class="corrections" min="0" oninput="validateInput(this)"></td>' +
      '<td><input type="number" class="word-openings" min="0" oninput="validateInput(this)"></td>' +
      '<td><input type="number" class="verse-openings" min="0" oninput="validateInput(this)"></td>' +
      '<td><input type="number" class="memorized-with-recitation" min="0" oninput="validateInput(this)"></td>' +
      '<td><input type="number" class="memorized-no-recitation" min="0" oninput="validateInput(this)"></td>' +
      '<td><span class="result">0</span></td>' +
      '</tr>';
  }

  var content = '<h3 class="calculator-title">' + testName + '</h3>' +
    '<div class="table-container">' +
    '<table class="calculator-table">' +
    '<thead>' +
    '<tr>' +
    '<th>#</th>' +
    '<th>عدد تصحيح الحركات</th>' +
    '<th>عدد فتح الكلمات</th>' +
    '<th>عدد فتح الآيات</th>' +
    '<th>عدد التأتأة مع تنبيه</th>' +
    '<th>عدد التأتأة بدون تنبيه</th>' +
    '<th>النتيجة</th>' +
    '</tr>' +
    '</thead>' +
    '<tbody>' + rows + '</tbody>' +
    '</table>' +
    '</div>' +
    '<div class="button-container">' +
    '<button class="main-calculate-btn" onclick="calculateTestResults(\'' + type + '\')">احسب النتائج</button>' +
    '</div>';

  document.getElementById('testing-content').innerHTML = content;
  document.getElementById('result-content').innerHTML = '';
}

function calculateTestResults(type) {
  var totalResult = 0;

  document.querySelectorAll('#testing-content tbody tr').forEach(function (row) {
    var corrections = parseInt(row.querySelector('.corrections').value) || 0;
    var wordOpenings = parseInt(row.querySelector('.word-openings').value) || 0;
    var verseOpenings = parseInt(row.querySelector('.verse-openings').value) || 0;
    var memorizedNoRecitation = parseInt(row.querySelector('.memorized-no-recitation').value) || 0;
    var memorizedWithRecitation = parseInt(row.querySelector('.memorized-with-recitation').value) || 0;

    var result = corrections * 2 + wordOpenings * 1 + verseOpenings * 2 + memorizedNoRecitation * 0.1 + memorizedWithRecitation * 0.5;

    row.querySelector('.result').textContent = -result.toFixed(1);
    totalResult += result;
  });

  totalResult = 100 - totalResult;

  var status = totalResult >= 90 ? 'ناجح' : '';
  var emoji = '';

  if (totalResult >= 99) {
    emoji = '🥳';
  } else if (totalResult >= 95 && totalResult < 99) {
    emoji = '😎';
  } else if (totalResult >= 90 && totalResult < 95) {
    emoji = '😁';
  } else {
    emoji = '🤕';
  }

  var date = new Date().toLocaleDateString('ar-EG');
  var testName = type === 'monthly' ? 'الاختبار الشهري' : 'الاختبار التراكمي';

  var resultContent = '<table class="result-table">' +
    '<tbody>' +
    '<tr>' +
    '<td>نوع الاختبار</td>' +
    '<td>' + testName + '</td>' +
    '</tr>' +
    '<tr>' +
    '<td>النتيجة</td>' +
    '<td><span id="total-result">' + totalResult.toFixed(1) + ' ' + emoji + ' ' + status + '</span></td>' +
    '</tr>' +
    '<tr>' +
    '<td>التاريخ</td>' +
    '<td>' + date + '</td>' +
    '</tr>' +
    '</tbody>' +
    '</table>';

  document.getElementById('result-content').innerHTML = resultContent;

  if (totalResult >= 99) {
    showConfetti();
    var resultElement = document.getElementById('total-result');
    resultElement.style.animation = 'resultPulse 0.6s ease-in-out';
  }
}

// ===== QUIZ SECTION (Positions and Narration) =====
function showQuizCalculator() {
  showQuizType('positions');
}

function showQuizType(type) {
  // Update sub-nav buttons
  document.querySelectorAll('#quiz-section .sub-nav-btn').forEach(function (btn) {
    btn.classList.remove('active');
  });
  if (event && event.target) {
    event.target.classList.add('active');
  } else {
    document.querySelector('#quiz-section .sub-nav-btn').classList.add('active');
  }

  var defaultRowCount = type === 'positions' ? 3 : 1;
  var quizName = type === 'positions' ? 'المواضع' : 'السرد';

  // Entry count selector - only for positions, narration is fixed at 1
  var entrySelector = '';
  if (type === 'positions') {
    entrySelector = '<div class="entry-selector">' +
      '<label for="entry-count">عدد المواضع:</label>' +
      '<select id="entry-count" onchange="updateQuizRows(\'' + type + '\')">';

    for (var i = 1; i <= 10; i++) {
      var selected = i === defaultRowCount ? ' selected' : '';
      entrySelector += '<option value="' + i + '"' + selected + '>' + i + '</option>';
    }
    entrySelector += '</select></div>';
  }

  var rows = '';
  for (var i = 0; i < defaultRowCount; i++) {
    rows += '<tr>' +
      '<td>' + (i + 1) + '</td>' +
      '<td><input type="number" class="corrections" min="0" oninput="validateInput(this)"></td>' +
      '<td><input type="number" class="word-openings" min="0" oninput="validateInput(this)"></td>' +
      '<td><input type="number" class="verse-openings" min="0" oninput="validateInput(this)"></td>' +
      '<td><input type="number" class="memorized-with-recitation" min="0" oninput="validateInput(this)"></td>' +
      '<td><input type="number" class="memorized-no-recitation" min="0" oninput="validateInput(this)"></td>' +
      '<td><input type="number" class="ahkamMemAndNon" min="0" oninput="validateInput(this)"></td>' +
      '<td><input type="number" class="Meaning" min="0" oninput="validateInput(this)"></td>' +
      '<td><span class="result">0</span></td>' +
      '</tr>';
  }

  var content = '<h3 class="calculator-title">حاسبة المسابقات - ' + quizName + '</h3>' +
    entrySelector +
    '<div class="quiz-note">' +
    '<p><strong>ملاحظة:</strong> خانة المعاني تعني عدد أخطاء المفردات (يخصم نقطة لكل خطأ)</p>' +
    '<p>خانة أحكام الميم والنون تعني عدد أخطاء أحكام الميم والنون الساكنة (يخصم 0.5 لكل خطأ)</p>' +
    '</div>' +
    '<div class="table-container">' +
    '<table class="calculator-table">' +
    '<thead>' +
    '<tr>' +
    '<th>#</th>' +
    '<th>عدد تصحيح الحركات</th>' +
    '<th>عدد فتح الكلمات</th>' +
    '<th>عدد فتح الآيات</th>' +
    '<th>عدد التأتأة مع تنبيه</th>' +
    '<th>عدد التأتأة بدون تنبيه</th>' +
    '<th>أحكام الميم والنون</th>' +
    '<th>المعاني</th>' +
    '<th>النتيجة</th>' +
    '</tr>' +
    '</thead>' +
    '<tbody>' + rows + '</tbody>' +
    '</table>' +
    '</div>' +
    '<div class="button-container">' +
    '<button class="main-calculate-btn" onclick="calculateQuizResults(\'' + type + '\')">احسب النتائج</button>' +
    '</div>';

  document.getElementById('quiz-content').innerHTML = content;
  document.getElementById('result-content').innerHTML = '';
}

function calculateQuizResults(type) {
  var totalResult = 0;
  var quizName = type === 'positions' ? 'المواضع' : 'السرد';

  document.querySelectorAll('#quiz-content tbody tr').forEach(function (row) {
    var corrections = parseInt(row.querySelector('.corrections').value) || 0;
    var wordOpenings = parseInt(row.querySelector('.word-openings').value) || 0;
    var verseOpenings = parseInt(row.querySelector('.verse-openings').value) || 0;
    var memorizedNoRecitation = parseInt(row.querySelector('.memorized-no-recitation').value) || 0;
    var memorizedWithRecitation = parseInt(row.querySelector('.memorized-with-recitation').value) || 0;
    var ahkamMemAndNon = parseInt(row.querySelector('.ahkamMemAndNon').value) || 0;
    var Meaning = parseInt(row.querySelector('.Meaning').value) || 0;

    // المعاني: يخصم نقطة لكل خطأ
    // أحكام الميم والنون: يخصم 0.5 لكل خطأ
    var result = corrections * 2 + wordOpenings * 1 + verseOpenings * 2 + memorizedNoRecitation * 0.1 + memorizedWithRecitation * 0.5 + ahkamMemAndNon * 0.5 + Meaning * 1;

    row.querySelector('.result').textContent = -result.toFixed(1);
    totalResult += result;
  });

  totalResult = 100 - totalResult;

  var status = totalResult >= 90 ? 'ناجح' : '';
  var emoji = '';

  if (totalResult >= 99) {
    emoji = '🥳';
  } else if (totalResult >= 95 && totalResult < 99) {
    emoji = '😎';
  } else if (totalResult >= 90 && totalResult < 95) {
    emoji = '😁';
  } else {
    emoji = '🤕';
  }

  var date = new Date().toLocaleDateString('ar-EG');

  var resultContent = '<table class="result-table">' +
    '<tbody>' +
    '<tr>' +
    '<td>نوع التقييم</td>' +
    '<td>المسابقات - ' + quizName + '</td>' +
    '</tr>' +
    '<tr>' +
    '<td>النتيجة</td>' +
    '<td><span id="total-result">' + totalResult.toFixed(1) + ' ' + emoji + ' ' + status + '</span></td>' +
    '</tr>' +
    '<tr>' +
    '<td>التاريخ</td>' +
    '<td>' + date + '</td>' +
    '</tr>' +
    '</tbody>' +
    '</table>';

  document.getElementById('result-content').innerHTML = resultContent;

  if (totalResult >= 90) {
    showConfetti();
    var resultElement = document.getElementById('total-result');
    resultElement.style.animation = 'resultPulse 0.6s ease-in-out';
  }
}

function updateQuizRows(type) {
  var rowCount = parseInt(document.getElementById('entry-count').value) || 1;
  var quizName = type === 'positions' ? 'المواضع' : 'السرد';

  var rows = '';
  for (var i = 0; i < rowCount; i++) {
    rows += '<tr>' +
      '<td>' + (i + 1) + '</td>' +
      '<td><input type="number" class="corrections" min="0" oninput="validateInput(this)"></td>' +
      '<td><input type="number" class="word-openings" min="0" oninput="validateInput(this)"></td>' +
      '<td><input type="number" class="verse-openings" min="0" oninput="validateInput(this)"></td>' +
      '<td><input type="number" class="memorized-with-recitation" min="0" oninput="validateInput(this)"></td>' +
      '<td><input type="number" class="memorized-no-recitation" min="0" oninput="validateInput(this)"></td>' +
      '<td><input type="number" class="ahkamMemAndNon" min="0" oninput="validateInput(this)"></td>' +
      '<td><input type="number" class="Meaning" min="0" oninput="validateInput(this)"></td>' +
      '<td><span class="result">0</span></td>' +
      '</tr>';
  }

  document.querySelector('#quiz-content tbody').innerHTML = rows;
  document.getElementById('result-content').innerHTML = '';
}

// ===== UTILITY FUNCTIONS =====
function validateInput(input) {
  if (input.value < 0) {
    input.value = '';
  }
}

function openInstructions() {
  window.location.href = 'instructions.html';
}

// ===== CONFETTI ANIMATION =====
function showConfetti() {
  var colors = [
    '#039f9e', '#c79c66', '#d4b38a',
    '#027a79', '#e0c9a8', '#048988',
    '#b88f5a', '#05b1b0', '#c9a876'
  ];

  var confettiCount = 100;

  for (var i = 0; i < confettiCount; i++) {
    (function (index) {
      setTimeout(function () {
        createConfettiPiece(colors[Math.floor(Math.random() * colors.length)]);
      }, Math.random() * 800);
    })(i);
  }
}

function createConfettiPiece(color) {
  var confetti = document.createElement('div');
  var size = Math.random() * 8 + 4;
  var startX = Math.random() * window.innerWidth;
  var velocityX = (Math.random() - 0.5) * 150;
  var rotationSpeed = Math.random() * 180 + 90;

  confetti.style.cssText =
    'position: fixed;' +
    'width: ' + size + 'px;' +
    'height: ' + size + 'px;' +
    'background: linear-gradient(45deg, ' + color + ', ' + adjustBrightness(color, 20) + ');' +
    'border-radius: 3px;' +
    'pointer-events: none;' +
    'z-index: 1000;' +
    'left: ' + startX + 'px;' +
    'top: -50px;' +
    'opacity: 1;' +
    'box-shadow: 0 0 6px rgba(0,0,0,0.1);' +
    'animation: confettiFall3D ' + (3 + Math.random() * 1.5) + 's linear forwards;';

  confetti.style.setProperty('--velocity-x', velocityX + 'px');
  confetti.style.setProperty('--rotation', rotationSpeed + 'deg');

  document.body.appendChild(confetti);

  setTimeout(function () {
    if (confetti.parentNode) {
      confetti.parentNode.removeChild(confetti);
    }
  }, 5000);
}

function adjustBrightness(hex, percent) {
  var num = parseInt(hex.replace('#', ''), 16);
  var amt = Math.round(2.55 * percent);
  var R = (num >> 16) + amt;
  var G = (num >> 8 & 0x00FF) + amt;
  var B = (num & 0x0000FF) + amt;
  return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
    (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
    (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
}

// ===== CONSOLIDATION SECTION (7 Positions + Bonus Table) =====
function showConsolidationCalculator() {
  var rows = '';
  for (var i = 0; i < 7; i++) {
    rows += '<tr>' +
      '<td>' + (i + 1) + '</td>' +
      '<td><input type="number" class="corrections" min="0" oninput="validateInput(this)"></td>' +
      '<td><input type="number" class="word-openings" min="0" oninput="validateInput(this)"></td>' +
      '<td><input type="number" class="verse-openings" min="0" oninput="validateInput(this)"></td>' +
      '<td><input type="number" class="memorized-with-recitation" min="0" oninput="validateInput(this)"></td>' +
      '<td><input type="number" class="memorized-no-recitation" min="0" oninput="validateInput(this)"></td>' +
      '<td><span class="result">0</span></td>' +
      '</tr>';
  }

  var content = '<h3 class="calculator-title">حاسبة التثبيت</h3>' +
    '<div class="table-container">' +
    '<table class="calculator-table">' +
    '<thead>' +
    '<tr>' +
    '<th>#</th>' +
    '<th>عدد تصحيح الحركات</th>' +
    '<th>عدد فتح الكلمات</th>' +
    '<th>عدد فتح الآيات</th>' +
    '<th>عدد التأتأة مع تنبيه</th>' +
    '<th>عدد التأتأة بدون تنبيه</th>' +
    '<th>النتيجة</th>' +
    '</tr>' +
    '</thead>' +
    '<tbody>' + rows + '</tbody>' +
    '</table>' +
    '</div>' +
    '<h3 class="calculator-title bonus-title">الأسئلة الإضافية (بونص)</h3>' +
    '<div class="table-container">' +
    '<table class="bonus-table">' +
    '<thead>' +
    '<tr>' +
    '<th>رقم السؤال</th>' +
    '<th>السؤال</th>' +
    '<th>الإجابة الصحيحة</th>' +
    '<th>النقاط الإضافية</th>' +
    '</tr>' +
    '</thead>' +
    '<tbody>' +
    '<tr>' +
    '<td>إضافي 1</td>' +
    '<td>سؤال إضافي رقم 1</td>' +
    '<td><label class="checkbox-container"><input type="checkbox" class="bonus-q1" onchange="updateBonusPoints()"><span class="checkmark"></span></label></td>' +
    '<td><span class="bonus-points" id="bonus-q1-points">0</span></td>' +
    '</tr>' +
    '<tr>' +
    '<td>إضافي 2</td>' +
    '<td>سؤال إضافي رقم 2</td>' +
    '<td><label class="checkbox-container"><input type="checkbox" class="bonus-q2" onchange="updateBonusPoints()"><span class="checkmark"></span></label></td>' +
    '<td><span class="bonus-points" id="bonus-q2-points">0</span></td>' +
    '</tr>' +
    '</tbody>' +
    '</table>' +
    '</div>' +
    '<div class="button-container">' +
    '<button class="main-calculate-btn" onclick="calculateConsolidationResults()">احسب النتائج</button>' +
    '</div>';

  document.getElementById('consolidation-content').innerHTML = content;
  document.getElementById('result-content').innerHTML = '';
}

function calculateConsolidationResults() {
  var totalResult = 0;

  document.querySelectorAll('#consolidation-content .calculator-table tbody tr').forEach(function (row) {
    var corrections = parseInt(row.querySelector('.corrections').value) || 0;
    var wordOpenings = parseInt(row.querySelector('.word-openings').value) || 0;
    var verseOpenings = parseInt(row.querySelector('.verse-openings').value) || 0;
    var memorizedNoRecitation = parseInt(row.querySelector('.memorized-no-recitation').value) || 0;
    var memorizedWithRecitation = parseInt(row.querySelector('.memorized-with-recitation').value) || 0;

    var result = corrections * 2 + wordOpenings * 1 + verseOpenings * 2 + memorizedNoRecitation * 0.1 + memorizedWithRecitation * 0.5;

    row.querySelector('.result').textContent = -result.toFixed(1);
    totalResult += result;
  });

  // Calculate bonus from checkboxes (0.5 each)
  var q1Checked = document.querySelector('.bonus-q1') ? document.querySelector('.bonus-q1').checked : false;
  var q2Checked = document.querySelector('.bonus-q2') ? document.querySelector('.bonus-q2').checked : false;
  var bonusTotal = (q1Checked ? 0.5 : 0) + (q2Checked ? 0.5 : 0);

  // Final result: 100 - deductions + bonus (can exceed 100 with bonus)
  var baseResult = 100 - totalResult;
  var finalResult = baseResult + bonusTotal;

  var status = '';
  var emoji = '';

  if (finalResult >= 99) {
    emoji = '🥳';
    status = 'ممتاز';
  } else if (finalResult >= 95) {
    emoji = '😎';
    status = 'جيد جداً';
  } else if (finalResult >= 90) {
    emoji = '😁';
    status = 'جيد';
  } else {
    emoji = '🤕';
    status = 'يحتاج تحسين';
  }

  var date = new Date().toLocaleDateString('ar-EG');

  var bonusDisplay = bonusTotal > 0 ? '+' + bonusTotal.toFixed(1) : '0';
  var resultContent = '<table class="result-table">' +
    '<tbody>' +
    '<tr>' +
    '<td>نوع التقييم</td>' +
    '<td>التثبيت</td>' +
    '</tr>' +
    '<tr>' +
    '<td>النتيجة الأساسية</td>' +
    '<td>' + baseResult.toFixed(1) + '</td>' +
    '</tr>' +
    '<tr>' +
    '<td>البونص</td>' +
    '<td>' + bonusDisplay + '</td>' +
    '</tr>' +
    '<tr>' +
    '<td>النتيجة النهائية</td>' +
    '<td><span id="total-result">' + finalResult.toFixed(1) + ' ' + emoji + ' ' + status + '</span></td>' +
    '</tr>' +
    '</tbody>' +
    '</table>';

  document.getElementById('result-content').innerHTML = resultContent;

  if (finalResult >= 99) {
    showConfetti();
    var resultElement = document.getElementById('total-result');
    resultElement.style.animation = 'resultPulse 0.6s ease-in-out';
  }
}

function resetConsolidation() {
  showConsolidationCalculator();
}

// Update bonus points when checkbox changes (0.5 each)
function updateBonusPoints() {
  var q1Checked = document.querySelector('.bonus-q1') ? document.querySelector('.bonus-q1').checked : false;
  var q2Checked = document.querySelector('.bonus-q2') ? document.querySelector('.bonus-q2').checked : false;

  if (document.getElementById('bonus-q1-points')) {
    document.getElementById('bonus-q1-points').textContent = q1Checked ? '+0.5' : '0';
  }
  if (document.getElementById('bonus-q2-points')) {
    document.getElementById('bonus-q2-points').textContent = q2Checked ? '+0.5' : '0';
  }
}

// ===== INITIALIZE ON PAGE LOAD =====
document.addEventListener('DOMContentLoaded', function () {
  // Load default section content
  showReviewCalculator();

  // Load Surah list for all verse selectors
  loadSurahList();

  // Preload full Quran for instant local search (optional - improves search speed)
  // Delayed to not block initial page load
  setTimeout(function () {
    QuranSearch.preloadFullQuran();
  }, 2000);
});

// ========================================
// QURAN VERSE DISPLAY COMPONENT
// (Display verses above calculators for supervisors)
// ========================================

// ===== SURAH DATA CACHE =====
var surahListCache = null;

// ===== LOAD SURAH LIST INTO ALL DROPDOWNS =====
function loadSurahList() {
  // If already cached, use cache
  if (surahListCache) {
    populateSurahDropdowns(surahListCache);
    return;
  }

  // Fetch surah list from API
  fetch('https://api.alquran.cloud/v1/surah')
    .then(function (response) {
      return response.json();
    })
    .then(function (data) {
      if (data.code === 200 && data.data) {
        surahListCache = data.data;
        populateSurahDropdowns(data.data);
      }
    })
    .catch(function (error) {
      console.error('Error loading surah list:', error);
    });
}

// ===== POPULATE ALL SURAH DROPDOWNS =====
function populateSurahDropdowns(surahs) {
  var dropdownIds = [
    'review-surah-select',
    'testing-surah-select',
    'consolidation-surah-select',
    'quiz-surah-select'
  ];

  dropdownIds.forEach(function (dropdownId) {
    var dropdown = document.getElementById(dropdownId);
    if (dropdown) {
      // Clear existing options except first
      dropdown.innerHTML = '<option value="">اختر السورة...</option>';

      // Add surah options
      surahs.forEach(function (surah) {
        var option = document.createElement('option');
        option.value = surah.number;
        option.textContent = surah.number + '. ' + surah.name + ' (' + surah.englishName + ')';
        option.setAttribute('data-ayah-count', surah.numberOfAyahs);
        dropdown.appendChild(option);
      });
    }
  });
}

// ===== HANDLE SURAH SELECTION CHANGE =====
function onSurahChange(section) {
  var surahSelect = document.getElementById(section + '-surah-select');
  var ayahStartInput = document.getElementById(section + '-ayah-start');
  var ayahEndInput = document.getElementById(section + '-ayah-end');

  if (surahSelect && surahSelect.value) {
    var selectedOption = surahSelect.options[surahSelect.selectedIndex];
    var ayahCount = parseInt(selectedOption.getAttribute('data-ayah-count')) || 1;

    // Set max values for ayah inputs
    ayahStartInput.max = ayahCount;
    ayahEndInput.max = ayahCount;

    // Reset to valid values
    ayahStartInput.value = 1;
    ayahEndInput.value = Math.min(10, ayahCount); // Default to first 10 ayahs or max
  }
}

// ===== SURAH DATA CACHE =====
var surahDataCache = {};  // Cache for full surah data

// ===== LOAD AND DISPLAY VERSES =====
function loadVerses(section) {
  var surahSelect = document.getElementById(section + '-surah-select');
  var ayahStart = parseInt(document.getElementById(section + '-ayah-start').value) || 1;
  var ayahEnd = parseInt(document.getElementById(section + '-ayah-end').value) || 1;
  var displayArea = document.getElementById(section + '-quran-page');

  // Validate inputs
  if (!surahSelect.value) {
    displayArea.innerHTML = '<div class="quran-placeholder">🕌 الرجاء اختيار السورة أولاً</div>';
    return;
  }

  var surahNumber = parseInt(surahSelect.value);
  var selectedOption = surahSelect.options[surahSelect.selectedIndex];
  var surahName = selectedOption.textContent.split('.')[1].split('(')[0].trim();
  var maxAyahs = parseInt(selectedOption.getAttribute('data-ayah-count')) || 1;

  // Validate ayah range
  if (ayahStart < 1) ayahStart = 1;
  if (ayahEnd > maxAyahs) ayahEnd = maxAyahs;
  if (ayahStart > ayahEnd) {
    var temp = ayahStart;
    ayahStart = ayahEnd;
    ayahEnd = temp;
  }

  // Check cache first
  if (surahDataCache[surahNumber]) {
    displayVersesInSection(surahDataCache[surahNumber], ayahStart, ayahEnd, displayArea);
    return;
  }

  // Show loading state
  displayArea.innerHTML = '<div class="quran-loading">' +
    '<div class="loading-spinner"></div>' +
    '<span>جاري تحميل الآيات...</span>' +
    '</div>';

  // Build API URL for range
  var apiUrl = 'https://api.alquran.cloud/v1/surah/' + surahNumber + '/ar';

  fetch(apiUrl)
    .then(function (response) {
      return response.json();
    })
    .then(function (data) {
      if (data.code === 200 && data.data && data.data.ayahs) {
        // Cache the surah data
        surahDataCache[surahNumber] = data.data;
        displayVersesInSection(data.data, ayahStart, ayahEnd, displayArea);
      } else {
        displayArea.innerHTML = '<div class="quran-error">حدث خطأ أثناء تحميل الآيات</div>';
      }
    })
    .catch(function (error) {
      displayArea.innerHTML = '<div class="quran-error">تعذر الاتصال بالخادم. الرجاء المحاولة مرة أخرى.</div>';
      console.error('Error loading verses:', error);
    });
}

// ===== CURRENT DISPLAY STATE FOR NAVIGATION =====
var currentDisplayState = {};

// ===== DISPLAY VERSES IN SECTION (Quran Page Style) =====
function displayVersesInSection(surahData, startAyah, endAyah, displayArea, highlightAyah) {
  var html = '';

  // Store current state for navigation
  var section = displayArea.id.replace('-quran-page', '');
  currentDisplayState[section] = {
    surahNumber: surahData.number,
    surahName: surahData.name,
    startAyah: startAyah,
    endAyah: endAyah,
    maxAyahs: surahData.numberOfAyahs
  };

  // Surah header with decorative border (remove duplicate "سورة" - surahData.name already contains it for some)
  var surahDisplayName = surahData.name;
  // If name already starts with سورة, don't add it again
  if (!surahDisplayName.startsWith('سورة')) {
    surahDisplayName = surahDisplayName;
  }

  html += '<div class="quran-surah-header">';
  html += '<div class="quran-surah-name">' + surahDisplayName + '</div>';
  html += '<div class="quran-ayah-range">الآيات ' + startAyah + ' - ' + endAyah + '</div>';
  html += '</div>';

  // Add Bismillah for surahs other than Al-Fatiha (1) and At-Tawbah (9)
  // Only show if starting from ayah 1
  if (startAyah === 1 && surahData.number !== 1 && surahData.number !== 9) {
    html += '<div class="quran-bismillah">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>';
  }

  // Filter verses
  var verses = surahData.ayahs.filter(function (ayah) {
    return ayah.numberInSurah >= startAyah && ayah.numberInSurah <= endAyah;
  });

  // Display verses inline (Quran page style)
  html += '<div class="quran-verses-content">';
  verses.forEach(function (ayah, index) {
    var isHighlighted = highlightAyah && ayah.numberInSurah === highlightAyah;
    var highlightClass = isHighlighted ? ' quran-highlight' : '';
    html += '<span class="quran-verse' + highlightClass + '" data-ayah="' + ayah.numberInSurah + '">';
    html += ayah.text;
    html += '<span class="ayah-number">' + convertToArabicNumerals(ayah.numberInSurah) + '</span>';
    html += '</span> ';
  });
  html += '</div>';

  // Navigation arrows
  var canGoPrev = startAyah > 1;
  var canGoNext = endAyah < surahData.numberOfAyahs;

  html += '<div class="quran-navigation">';
  html += '<button class="quran-nav-btn' + (canGoPrev ? '' : ' disabled') + '" onclick="navigateVerses(\'' + section + '\', \'prev\')" ' + (canGoPrev ? '' : 'disabled') + '>';
  html += '<span class="nav-arrow">→</span> الصفحة السابقة';
  html += '</button>';
  html += '<button class="quran-nav-btn' + (canGoNext ? '' : ' disabled') + '" onclick="navigateVerses(\'' + section + '\', \'next\')" ' + (canGoNext ? '' : 'disabled') + '>';
  html += 'الصفحة التالية <span class="nav-arrow">←</span>';
  html += '</button>';
  html += '</div>';

  displayArea.innerHTML = html;

  // Scroll to highlighted ayah if exists
  if (highlightAyah) {
    var highlightedElement = displayArea.querySelector('.quran-highlight');
    if (highlightedElement) {
      highlightedElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
}

// ===== NAVIGATE VERSES (NEXT/PREV PAGE) =====
function navigateVerses(section, direction) {
  var state = currentDisplayState[section];
  if (!state) return;

  var pageSize = state.endAyah - state.startAyah + 1;
  var newStart, newEnd;

  if (direction === 'next') {
    newStart = state.endAyah + 1;
    newEnd = Math.min(newStart + pageSize - 1, state.maxAyahs);
  } else {
    newEnd = state.startAyah - 1;
    newStart = Math.max(newEnd - pageSize + 1, 1);
  }

  // Update inputs
  document.getElementById(section + '-ayah-start').value = newStart;
  document.getElementById(section + '-ayah-end').value = newEnd;

  // Load new verses
  loadVerses(section);
}

// ===== CONVERT TO ARABIC NUMERALS =====
function convertToArabicNumerals(num) {
  var arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(num).split('').map(function (digit) {
    return arabicNumerals[parseInt(digit)];
  }).join('');
}

// ===== INTEGRATED VERSE SEARCH =====
var sectionSearchTimeouts = {};  // Debounce per section

// ===== QURAN SEARCH CONFIGURATION =====
var QuranSearch = {
  // Primary API: Quran.com v4 (most reliable, verse-only)
  API_BASE: 'https://api.quran.com/api/v4',

  // Cache for all surahs (for local search)
  fullQuranCache: null,
  isLoadingFullQuran: false,

  // Preload entire Quran for instant local search
  preloadFullQuran: function () {
    if (this.fullQuranCache || this.isLoadingFullQuran) return;
    this.isLoadingFullQuran = true;

    var self = this;
    // Load from Quran.com API - get all verses in simple Arabic
    fetch(this.API_BASE + '/quran/verses/uthmani?per_page=6236')
      .then(function (response) {
        if (!response.ok) throw new Error('API error');
        return response.json();
      })
      .then(function (data) {
        if (data.verses) {
          self.fullQuranCache = data.verses.map(function (v) {
            return {
              text: v.text_uthmani,
              verseKey: v.verse_key,
              surahNumber: parseInt(v.verse_key.split(':')[0]),
              ayahNumber: parseInt(v.verse_key.split(':')[1])
            };
          });
          console.log('Quran preloaded: ' + self.fullQuranCache.length + ' verses');
        }
      })
      .catch(function (error) {
        console.log('Preload failed, will use API search:', error);
        self.isLoadingFullQuran = false;
      });
  }
};

function searchVerseInSection(section) {
  var searchInput = document.getElementById(section + '-verse-search');
  var resultsContainer = document.getElementById(section + '-search-results');
  var searchTerm = searchInput.value.trim();

  // Clear previous timeout
  if (sectionSearchTimeouts[section]) {
    clearTimeout(sectionSearchTimeouts[section]);
  }

  // Hide results if empty
  if (searchTerm.length === 0) {
    resultsContainer.classList.add('hidden');
    return;
  }

  // Minimum 2 characters
  if (searchTerm.length < 2) {
    resultsContainer.innerHTML = '<div class="search-result-item">اكتب حرفين على الأقل...</div>';
    resultsContainer.classList.remove('hidden');
    return;
  }

  // Show loading
  resultsContainer.innerHTML = '<div class="search-result-item">جاري البحث...</div>';
  resultsContainer.classList.remove('hidden');

  // Debounce - 300ms for responsive autocomplete
  sectionSearchTimeouts[section] = setTimeout(function () {
    performQuranSearch(searchTerm, section, resultsContainer);
  }, 300);
}

// ===== ARABIC TEXT NORMALIZATION (COMPREHENSIVE) =====
function normalizeArabic(text) {
  if (!text) return '';

  var normalized = text;

  // 1. Remove ALL tashkeel (diacritics) - comprehensive range
  normalized = normalized.replace(/[\u064B-\u065F\u0670]/g, '');

  // 2. Remove tatweel (kashida/elongation)
  normalized = normalized.replace(/\u0640/g, '');

  // 3. Normalize Alef variants (أ إ آ ٱ ا → ا)
  normalized = normalized.replace(/[\u0622\u0623\u0625\u0627\u0671]/g, '\u0627');

  // 4. Normalize Taa Marbuta (ة → ه)
  normalized = normalized.replace(/\u0629/g, '\u0647');

  // 5. Normalize Alef Maksura (ى → ي)
  normalized = normalized.replace(/\u0649/g, '\u064A');

  // 6. Normalize Hamza on carriers (ؤ → و, ئ → ي)
  normalized = normalized.replace(/\u0624/g, '\u0648');
  normalized = normalized.replace(/\u0626/g, '\u064A');

  // 7. Remove standalone Hamza (ء)
  normalized = normalized.replace(/\u0621/g, '');

  // 8. Remove Quranic annotation marks (tajweed, sajda, etc.)
  normalized = normalized.replace(/[\u06D6-\u06ED]/g, '');

  // 9. Remove decorative symbols
  normalized = normalized.replace(/[۝۩۞﴾﴿۰-۹]/g, '');

  // 10. Normalize whitespace
  normalized = normalized.trim().replace(/\s+/g, ' ');

  return normalized;
}

// ===== MAIN SEARCH FUNCTION =====
function performQuranSearch(searchTerm, section, resultsContainer) {
  var normalizedSearch = normalizeArabic(searchTerm);

  if (normalizedSearch.length < 2) {
    resultsContainer.innerHTML = '<div class="search-result-item">أدخل كلمة للبحث</div>';
    return;
  }

  var allMatches = [];

  // STRATEGY 1: Search in local surah cache first (fastest)
  for (var surahNum in surahDataCache) {
    if (surahDataCache.hasOwnProperty(surahNum)) {
      var surahData = surahDataCache[surahNum];

      surahData.ayahs.forEach(function (ayah) {
        var normalizedText = normalizeArabic(ayah.text);

        // Exact phrase match - the search phrase must appear as continuous text
        if (normalizedText.indexOf(normalizedSearch) !== -1) {
          allMatches.push({
            text: ayah.text,
            numberInSurah: ayah.numberInSurah,
            surah: {
              number: surahData.number,
              name: surahData.name
            }
          });
        }
      });
    }
  }

  // STRATEGY 2: If preloaded full Quran cache exists, search there
  if (allMatches.length === 0 && QuranSearch.fullQuranCache) {
    QuranSearch.fullQuranCache.forEach(function (verse) {
      var normalizedText = normalizeArabic(verse.text);

      if (normalizedText.indexOf(normalizedSearch) !== -1) {
        // Get surah name from cache
        var surahName = getSurahNameFromNumber(verse.surahNumber);
        allMatches.push({
          text: verse.text,
          numberInSurah: verse.ayahNumber,
          surah: {
            number: verse.surahNumber,
            name: surahName
          }
        });
      }
    });
  }

  // STRATEGY 3: Fallback to API if local search has no results
  if (allMatches.length === 0) {
    performQuranComAPISearch(searchTerm, section, resultsContainer);
    return;
  }

  // Display local results
  if (allMatches.length > 0) {
    displaySearchResultsInSection(allMatches, section, searchTerm);
  } else {
    resultsContainer.innerHTML = '<div class="search-result-item">لم يتم العثور على نتائج</div>';
  }
}

// ===== GET SURAH NAME FROM NUMBER =====
function getSurahNameFromNumber(surahNumber) {
  if (surahListCache) {
    var surah = surahListCache.find(function (s) {
      return s.number === surahNumber;
    });
    if (surah) return surah.name;
  }
  return 'سورة ' + surahNumber;
}

// ===== QURAN.COM API SEARCH (Primary API - Verse Only) =====
function performQuranComAPISearch(searchTerm, section, resultsContainer) {
  // Quran.com API v4 search endpoint
  var apiUrl = QuranSearch.API_BASE + '/search?q=' + encodeURIComponent(searchTerm) +
    '&size=20&page=1&language=ar';

  fetch(apiUrl)
    .then(function (response) {
      if (!response.ok) {
        throw new Error('Quran.com API error: ' + response.status);
      }
      return response.json();
    })
    .then(function (data) {
      if (data.search && data.search.results && data.search.results.length > 0) {
        var normalizedSearch = normalizeArabic(searchTerm);

        // Filter and map results - Quran.com returns pure verses
        var matches = data.search.results.filter(function (result) {
          // Quran.com returns verse_key like "2:255"
          // Double-check with normalization
          var normalizedText = normalizeArabic(result.text);
          return normalizedText.indexOf(normalizedSearch) !== -1;
        }).map(function (result) {
          var parts = result.verse_key.split(':');
          return {
            text: result.text,
            numberInSurah: parseInt(parts[1]),
            surah: {
              number: parseInt(parts[0]),
              name: getSurahNameFromNumber(parseInt(parts[0]))
            }
          };
        });

        if (matches.length > 0) {
          displaySearchResultsInSection(matches, section, searchTerm);
        } else {
          // Fallback to alquran.cloud if Quran.com returns no matches
          performAlQuranCloudSearch(searchTerm, section, resultsContainer);
        }
      } else {
        // Fallback to alquran.cloud
        performAlQuranCloudSearch(searchTerm, section, resultsContainer);
      }
    })
    .catch(function (error) {
      console.error('Quran.com search error:', error);
      // Fallback to alquran.cloud
      performAlQuranCloudSearch(searchTerm, section, resultsContainer);
    });
}

// ===== ALQURAN.CLOUD API SEARCH (Fallback) =====
function performAlQuranCloudSearch(searchTerm, section, resultsContainer) {
  // Use quran-uthmani edition for pure Quran text only
  var apiUrl = 'https://api.alquran.cloud/v1/search/' +
    encodeURIComponent(searchTerm.trim()) + '/all/quran-uthmani';

  fetch(apiUrl)
    .then(function (response) {
      if (response.status === 404) {
        return { code: 200, data: { matches: [] } };
      }
      if (!response.ok) {
        throw new Error('API returned ' + response.status);
      }
      return response.json();
    })
    .then(function (data) {
      if (data.code === 200 && data.data && data.data.matches && data.data.matches.length > 0) {
        var normalizedSearch = normalizeArabic(searchTerm.trim());

        // STRICT filtering for pure Quran verses only
        var filteredMatches = data.data.matches.filter(function (match) {
          var normalizedText = normalizeArabic(match.text);

          // Must contain exact search phrase
          if (normalizedText.indexOf(normalizedSearch) === -1) {
            return false;
          }

          // STRICT: Only accept from known Quran editions (not tafsir)
          var edition = match.edition ? match.edition.identifier : '';
          var validEditions = ['quran-uthmani', 'quran-simple', 'ar.alafasy', 'ar'];
          var isValidEdition = validEditions.some(function (e) {
            return edition.indexOf(e) !== -1 || edition === '';
          });

          // Reject if text looks like tafsir
          var text = match.text.trim();
          var isTafsir = text.length > 500 ||
            text.startsWith('قوله') ||
            text.startsWith('وقوله') ||
            text.startsWith('أي ') ||
            text.startsWith('يعني') ||
            text.startsWith('والمعنى') ||
            text.startsWith('تفسير') ||
            text.indexOf('{') !== -1 ||
            text.indexOf('تفسير') !== -1 ||
            text.indexOf('المعنى:') !== -1;

          return !isTafsir;
        });

        // Remove duplicates
        var seen = {};
        var uniqueMatches = filteredMatches.filter(function (match) {
          var key = match.surah.number + '-' + match.numberInSurah;
          if (seen[key]) return false;
          seen[key] = true;
          return true;
        });

        if (uniqueMatches.length > 0) {
          displaySearchResultsInSection(uniqueMatches, section, searchTerm);
        } else {
          resultsContainer.innerHTML = '<div class="search-result-item">لم يتم العثور على نتائج</div>';
        }
      } else {
        resultsContainer.innerHTML = '<div class="search-result-item">لم يتم العثور على نتائج</div>';
      }
    })
    .catch(function (error) {
      console.error('AlQuran.cloud search error:', error);
      resultsContainer.innerHTML = '<div class="search-result-item">حدث خطأ في البحث. حاول مرة أخرى.</div>';
    });
}

// ===== HIGHLIGHT MATCHED PHRASE IN TEXT =====
function highlightMatchedWords(text, searchTerm) {
  if (!searchTerm || !text) return text;

  var normalizedSearch = normalizeArabic(searchTerm);

  // Split search into words for highlighting
  var searchWords = normalizedSearch.split(' ').filter(function (w) {
    return w.length > 0;
  });

  // Split verse into words
  var words = text.split(' ');
  var highlightedWords = words.map(function (word) {
    var normalizedWord = normalizeArabic(word);

    // Check if this word matches any search word
    var isMatch = searchWords.some(function (searchWord) {
      return normalizedWord.indexOf(searchWord) !== -1 ||
        searchWord.indexOf(normalizedWord) !== -1;
    });

    if (isMatch) {
      return '<mark class="search-highlight">' + word + '</mark>';
    }
    return word;
  });

  return highlightedWords.join(' ');
}

// ===== DISPLAY SEARCH RESULTS IN SECTION =====
function displaySearchResultsInSection(matches, section, keyword) {
  var resultsContainer = document.getElementById(section + '-search-results');
  var html = '';

  // Limit to 10 results for better UX
  var limitedMatches = matches.slice(0, 10);

  limitedMatches.forEach(function (match) {
    // Always display the full original verse text
    // Highlight matched words for visual feedback only
    var highlightedText = highlightMatchedWords(match.text, keyword);
    var truncatedText = match.text.length > 80 ? highlightMatchedWords(match.text.substring(0, 80), keyword) + '...' : highlightedText;

    // Handle surah name - don't add "سورة" if already present
    var surahDisplay = match.surah.name;
    if (!surahDisplay.startsWith('سورة')) {
      surahDisplay = 'سورة ' + surahDisplay;
    }
    html += '<div class="search-result-item" onclick="jumpToSearchResult(\'' + section + '\', ' + match.surah.number + ', ' + match.numberInSurah + ')">';
    html += '<div class="search-result-text">' + truncatedText + '</div>';
    html += '<div class="search-result-info">' + surahDisplay + ' - آية ' + match.numberInSurah + '</div>';
    html += '</div>';
  });

  if (matches.length > 10) {
    html += '<div class="search-result-count">عُثر على ' + matches.length + ' نتيجة (عرض أول 10)</div>';
  } else if (matches.length > 0) {
    html += '<div class="search-result-count">عُثر على ' + matches.length + ' ' + (matches.length === 1 ? 'نتيجة' : 'نتائج') + '</div>';
  }

  resultsContainer.innerHTML = html;
}

// ===== JUMP TO SEARCH RESULT =====
function jumpToSearchResult(section, surahNumber, ayahNumber) {
  var surahSelect = document.getElementById(section + '-surah-select');
  var ayahStartInput = document.getElementById(section + '-ayah-start');
  var ayahEndInput = document.getElementById(section + '-ayah-end');
  var resultsContainer = document.getElementById(section + '-search-results');
  var searchInput = document.getElementById(section + '-verse-search');

  // Set the surah
  surahSelect.value = surahNumber;
  onSurahChange(section);

  // Calculate ayah range (show ±5 ayahs around the found ayah)
  var selectedOption = surahSelect.options[surahSelect.selectedIndex];
  var maxAyahs = parseInt(selectedOption.getAttribute('data-ayah-count')) || 1;

  var startAyah = Math.max(1, ayahNumber - 5);
  var endAyah = Math.min(maxAyahs, ayahNumber + 5);

  ayahStartInput.value = startAyah;
  ayahEndInput.value = endAyah;

  // Hide search results and clear input
  resultsContainer.classList.add('hidden');
  searchInput.value = '';

  // Load verses and highlight the found ayah
  loadVersesWithHighlight(section, ayahNumber);
}

// ===== LOAD VERSES WITH HIGHLIGHT =====
function loadVersesWithHighlight(section, highlightAyah) {
  var surahSelect = document.getElementById(section + '-surah-select');
  var ayahStart = parseInt(document.getElementById(section + '-ayah-start').value) || 1;
  var ayahEnd = parseInt(document.getElementById(section + '-ayah-end').value) || 1;
  var displayArea = document.getElementById(section + '-quran-page');

  var surahNumber = parseInt(surahSelect.value);

  // Check cache first
  if (surahDataCache[surahNumber]) {
    displayVersesInSection(surahDataCache[surahNumber], ayahStart, ayahEnd, displayArea, highlightAyah);
    return;
  }

  // Show loading state
  displayArea.innerHTML = '<div class="quran-loading">' +
    '<div class="loading-spinner"></div>' +
    '<span>جاري تحميل الآيات...</span>' +
    '</div>';

  var apiUrl = 'https://api.alquran.cloud/v1/surah/' + surahNumber + '/ar';

  fetch(apiUrl)
    .then(function (response) {
      return response.json();
    })
    .then(function (data) {
      if (data.code === 200 && data.data && data.data.ayahs) {
        surahDataCache[surahNumber] = data.data;
        displayVersesInSection(data.data, ayahStart, ayahEnd, displayArea, highlightAyah);
      } else {
        displayArea.innerHTML = '<div class="quran-error">حدث خطأ أثناء تحميل الآيات</div>';
      }
    })
    .catch(function (error) {
      displayArea.innerHTML = '<div class="quran-error">تعذر الاتصال بالخادم</div>';
      console.error('Error loading verses:', error);
    });
}

// ===== HIDE SEARCH RESULTS WHEN CLICKING OUTSIDE =====
document.addEventListener('click', function (event) {
  var searchRows = document.querySelectorAll('.quran-search-row');
  searchRows.forEach(function (row) {
    if (!row.contains(event.target)) {
      var resultsContainer = row.querySelector('.search-results-dropdown');
      if (resultsContainer) {
        resultsContainer.classList.add('hidden');
      }
    }
  });
});

// ===== LEGACY SEARCH FUNCTIONS REMOVED =====
// Search functionality is now integrated into each section via searchVerseInSection()

// ===== END OF FILE =====
