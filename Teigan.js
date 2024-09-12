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
    let corrections = parseInt(row.querySelector('.corrections').value) || 0;
    let wordOpenings = parseInt(row.querySelector('.word-openings').value) || 0;
    let verseOpenings = parseInt(row.querySelector('.verse-openings').value) || 0;
    let memorizedNoRecitation = parseInt(row.querySelector('.memorized-no-recitation').value) || 0;
    let memorizedWithRecitation = parseInt(row.querySelector('.memorized-with-recitation').value) || 0;

    // Initialize result
    let result = 0;

    // Points calculation based on the type
    if (type === 'monthly' || type === 'cumulative') {
      result = corrections * 2 + wordOpenings * 1 + verseOpenings * 2 + memorizedNoRecitation * 0.1 + memorizedWithRecitation * 0.5;
    } else if (type === 'competitions') {
      let ahkamMemAndNon = parseInt(row.querySelector('.ahkamMemAndNon')?.value) || 0; // Optional field for competitions
      let Meaning = parseInt(row.querySelector('.Meaning')?.value) || 0; // Optional field for competitions
      if (ahkamMemAndNon <= 2) {
        ahkamMemAndNon = 0;
      }
      else {
        ahkamMemAndNon -= 2;
      }
      result = corrections * 2 + wordOpenings * 1 + verseOpenings * 2 + memorizedNoRecitation * 0.1 + memorizedWithRecitation * 0.5 + Meaning * 2 + ahkamMemAndNon * 0.2;
    }

    // Update result for each row
    row.querySelector('.result').textContent = -result.toFixed(1);

    // Add to total result
    totalResult += result;
  });

  // Final total result
  totalResult = 100 - totalResult;

  // Determine status based on total score
  const status = totalResult >= 90 ? 'ناجح' : '';
  let emoji = ''; // Default empty emoji

  if (totalResult >= 99) {
    emoji = '🥳';
  } else if (totalResult >= 95 && totalResult < 99) {
    emoji = '😎';
  } else if (totalResult >= 90 && totalResult < 95) {
    emoji = '😁';
  } else {
    emoji = '🤕';
  }

  const date = new Date().toLocaleDateString();

  // Update result content
  const resultContent = `
    <table class="result-table">
      <tbody>
        <tr>
          <td>نوع الاختبار</td>
          <td>${type === 'monthly' ? 'الامتحان الشهري' : type === 'cumulative' ? 'الامتحان التراكمي' : 'المسابقات'}</td>
        </tr>
        <tr>
          <td>النتيجة</td>
          <td><span id="total-result">${totalResult.toFixed(1)} ${emoji} ${status}</span></td>
        </tr>
        <tr>
          <td>التاريخ</td>
          <td><span id="test-date">${date}</span></td>
        </tr>
      </tbody>
    </table>
  `;

  // Display the result
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
            <th> أحكام الميم والنون الساكنة </th>
            <th>المعاني</th>


            <th>النتيجة</th>
          </tr>
        </thead>
        <tbody>
          ${Array.from({ length: 3 }, (_, i) => `
            <tr>
               <td>${i + 1}</td>
               <td><input type="number" class="corrections" min="0" oninput="validateInput(this)"></td>
              <td><input type="number" class="word-openings" min="0" oninput="validateInput(this)"></td>
              <td><input type="number" class="verse-openings" min="0" oninput="validateInput(this)"></td>
              <td><input type="number" class="memorized-with-recitation" min="0" oninput="validateInput(this)"></td>           
              <td><input type="number" class="memorized-no-recitation" min="0" oninput="validateInput(this)"></td>
  
              <td><input type="number" class="ahkamMemAndNon" min="0" oninput="validateInput(this)"></td>
              <td><input type="number" class="Meaning" min="0" oninput="validateInput(this)"></td>
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
