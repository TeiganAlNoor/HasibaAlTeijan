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

// ===== REVIEW SECTION (95% passing, shows only Pass/Incomplete) =====
function showReviewCalculator() {
  var rows = '';
  for (var i = 0; i < 3; i++) {
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

  var content = '<h3 class="calculator-title">حاسبة اتصال المراجعة التراكميّ</h3>' +
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

  // Review section: 95% passing grade, show only "ناجح" or "غير مكتمل"
  var isPassing = totalResult >= 95;
  var statusText = isPassing ? '✅ ناجح' : '❌ غير مكتمل';
  var statusClass = isPassing ? 'result-pass' : 'result-incomplete';

  var date = new Date().toLocaleDateString('ar-EG');

  var resultContent = '<table class="result-table">' +
    '<tbody>' +
    '<tr>' +
    '<td>نوع التقييم</td>' +
    '<td>اتصال المراجعة التراكميّ</td>' +
    '</tr>' +
    '<tr>' +
    '<td>الحالة</td>' +
    '<td><span id="total-result" class="' + statusClass + '">' + statusText + '</span></td>' +
    '</tr>' +
    '<tr>' +
    '<td>التاريخ</td>' +
    '<td>' + date + '</td>' +
    '</tr>' +
    '</tbody>' +
    '</table>';

  document.getElementById('result-content').innerHTML = resultContent;

  if (isPassing) {
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

  var rowCount = type === 'positions' ? 3 : 1;
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

  var content = '<h3 class="calculator-title">حاسبة المسابقات - ' + quizName + '</h3>' +
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
});
