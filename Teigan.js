function showCalculatorCumulative(type) {
  let content = '';
  if (type === 'cumulative') {
    content = `
      <table class="calculator-table">
        <thead>
          <tr>
            <th>رقم الموضع</th>
            <th>عدد تصحيح الحركات</th>
            <th>عدد فتح الكلمات</th>
            <th>عدد فتح الآيات</th>
            <th>عدد التأتأة مع تنبيه</th>
            <th>عددالتأتأة بدون تنبيه</th>
            <th>النتيجة</th>
          </tr>
        </thead>
        <tbody>
          ${Array.from({ length: 7 }, (_, i) => `
            <tr>
              <td>${i + 1}</td>
              <td><input type="number" class="corrections" min="0" oninput="validateInput(this)"></td>
              <td><input type="number" class="word-openings" min="0" oninput="validateInput(this)"></td>
              <td><input type="number" class="verse-openings" min="0" oninput="validateInput(this)"></td>
              <td><input type="number" class="memorized-with-recitation" min="0" oninput="validateInput(this)"></td>
              <td><input type="number" class="memorized-no-recitation" min="0" oninput="validateInput(this)"></td>
              <td><span class="result">0</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
     <button class="calculate-button" onclick="calculateResults('${type}')">احسب النتائج</button>
    `;
  }
  document.getElementById('calculator-content').innerHTML = content;
}

function validateInput(input) {
  if (input.value < 0) {
    input.value = '';
  }
}

function calculateResults(type) {
  let totalResult = 0;
  document.querySelectorAll('#calculator-content tbody tr').forEach(row => {
    const corrections = (parseInt(row.querySelector('.corrections').value) || 0) * 2;// تصحيح حركات
    const wordOpenings = (parseInt(row.querySelector('.word-openings').value) || 0) * 1;// فتح كلمة 
    const verseOpenings = (parseInt(row.querySelector('.verse-openings').value) || 0) * 2;// فتح آية 
    const memorizedNoRecitation = (parseInt(row.querySelector('.memorized-no-recitation').value) || 0) * 0.1; // تأتاة بدون تنبيه 
    const memorizedWithRecitation = (parseInt(row.querySelector('.memorized-with-recitation').value) || 0) * 0.5;// تأتأة مع تنبيه
    const result = corrections + wordOpenings + verseOpenings + memorizedNoRecitation + memorizedWithRecitation; // النتيجة
    row.querySelector('.result').textContent = -result.toFixed(1);
    totalResult += result;
  });
  totalResult = 100 - totalResult
  const status = totalResult >= 90 ? 'ناجح' : '😡'; // تحديد معيار النجاح والرسوب
  const emoji = totalResult === 100 ? '😎 ' : ' ';
  const date = new Date().toLocaleDateString();

  const resultContent = `
    <table class="result-table">

<table>
          <tbody>
            <tr>
              <td>نوع الاختبار</td>
              <td>${type === 'monthly' ? ' الامتحان الشهري' : type === 'cumulative' ? 'الامتحان التراكمي ' : 'المسابقات'}</td>
            </tr>
            <tr>
              <td>النتيجة</td>
              <td><span id="total-result">${totalResult} ${emoji}   ${status}</span></td>
            </tr>
            <tr>
              <td>التاريخ</td>
              <td><span id="test-date">${new Date().toLocaleDateString()}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    `;







  document.getElementById('result-content').innerHTML = resultContent;
}



function showCalculatorCompetitions(type) {
  let content = '';
  if (type === 'competitions') {
    content = `
      <table class="calculator-table">
        <thead>
          <tr>
            <th>رقم الموضع</th>
            <th>عدد تصحيح الحركات</th>
            <th>عدد فتح الكلمات</th>
            <th>عدد فتح الآيات</th>
            <th>عدد التأتأة مع تنبيه</th>
            <th>عددالتأتأة بدون تنبيه</th>
            <th>النتيجة</th>
          </tr>
        </thead>
        <tbody>
          ${Array.from({ length: 1 }, (_, i) => `
            <tr>
              <td>سَرْد</td>
              <td><input type="number" class="corrections" min="0" oninput="validateInput(this)"></td>
              <td><input type="number" class="word-openings" min="0" oninput="validateInput(this)"></td>
              <td><input type="number" class="verse-openings" min="0" oninput="validateInput(this)"></td>
              <td><input type="number" class="memorized-with-recitation" min="0" oninput="validateInput(this)"></td>
              <td><input type="number" class="memorized-no-recitation" min="0" oninput="validateInput(this)"></td>
              <td><span class="result">0</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
     <button class="calculate-button" onclick="calculateResults('${type}')">احسب النتائج</button>
    `;
  }
  document.getElementById('calculator-content').innerHTML = content;
}


function showCalculatorMonthly(type) {
  let content = '';
  if (type === 'monthly') {
    content = `
      <table class="calculator-table">
        <thead>
          <tr>
            <th>رقم الموضع</th>
            <th>عدد تصحيح الحركات</th>
            <th>عدد فتح الكلمات</th>
            <th>عدد فتح الآيات</th>
            <th>عدد التأتأة مع تنبيه</th>
            <th>عددالتأتأة بدون تنبيه</th>
            <th>النتيجة</th>
          </tr>
        </thead>
        <tbody>
          ${Array.from({ length: 5 }, (_, i) => `
            <tr>
              <td>${i + 1}</td>
              <td><input type="number" class="corrections" min="0" oninput="validateInput(this)"></td>
              <td><input type="number" class="word-openings" min="0" oninput="validateInput(this)"></td>
              <td><input type="number" class="verse-openings" min="0" oninput="validateInput(this)"></td>
              <td><input type="number" class="memorized-with-recitation" min="0" oninput="validateInput(this)"></td>
              <td><input type="number" class="memorized-no-recitation" min="0" oninput="validateInput(this)"></td>
              <td><span class="result">0</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
     <button class="calculate-button" onclick="calculateResults('${type}')">احسب النتائج</button>

    `;
  }
  document.getElementById('calculator-content').innerHTML = content;
}

function openInstructions() {
  window.location.href = 'instructions.html'; // تغيير هذا الرابط إلى رابط صفحة التعليمات الفعلي
}
