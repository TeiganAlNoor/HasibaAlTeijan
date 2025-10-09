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
  let totalAhkamMemAndNon = 0; // Summation of ahkamMemAndNon for all rows

  // First, calculate the total sum of ahkamMemAndNon for all rows
  document.querySelectorAll('#calculator-content tbody tr').forEach(row => {
    let ahkamMemAndNon = parseInt(row.querySelector('.ahkamMemAndNon')?.value) || 0;
    totalAhkamMemAndNon += ahkamMemAndNon;
  });

  // Now calculate the result for each row
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
      let ahkamMemAndNon = parseInt(row.querySelector('.ahkamMemAndNon')?.value) || 0;
      let Meaning = parseInt(row.querySelector('.Meaning')?.value) || 0;

      // Apply the condition: ignore ahkamMemAndNon if total is less than 2
      if (totalAhkamMemAndNon <= 2) {
        ahkamMemAndNon = 0;
      } else if (ahkamMemAndNon > 2) {
        ahkamMemAndNon -= 2; // Apply reduction for individual rows
      }

      result = corrections * 2 + wordOpenings * 1 + verseOpenings * 2 + memorizedNoRecitation * 0.1 + memorizedWithRecitation * 0.5 + Meaning * 2 + ahkamMemAndNon * 0.2;
    }


    // Update result for each row
    row.querySelector('.result').textContent = -result.toFixed(1);



    // Add to total result
    totalResult += result;
  });

  if (totalAhkamMemAndNon > 2) {
    totalResult = totalResult - 0.4;
  }


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
          <td>${type === 'monthly' ? 'الامتحان الشهري' : type === 'cumulative' ? 'الامتحان التراكمي' : type === 'stabilization' ? 'اختبار التثبيت' : 'المسابقات'}</td>
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

  // Show confetti animation if result is above 99
  if (totalResult >= 99) {
    showConfetti();
    // Add pulse effect to result
    const resultElement = document.getElementById('total-result');
    resultElement.style.animation = 'resultPulse 0.6s ease-in-out';
  }
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

function showCalculatorStabilization(type) {
  let content = '';
  if (type === 'stabilization') {
    content = `
      <h2 class="calculator-title">حاسبة التثبيت</h2>
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
      
      <h3 class="bonus-title">الأسئلة الإضافية (بونص)</h3>
      <table class="calculator-table bonus-table">
        <thead>
          <tr>
            <th>رقم السؤال</th>
            <th>السؤال</th>
            <th>الإجابة الصحيحة</th>
            <th>النقاط الإضافية</th>
          </tr>
        </thead>
        <tbody>
          ${Array.from({ length: 2 }, (_, i) => `
            <tr>
              <td>إضافي ${i + 1}</td>
              <td>سؤال إضافي رقم ${i + 1}</td>
              <td>
                <label class="checkbox-container">
                  <input type="checkbox" class="bonus-answer" data-points="0.5">
                  <span class="checkmark"></span>
                  صحيح
                </label>
              </td>
              <td><span class="bonus-result">0</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <button class="calculate-button" onclick="calculateStabilizationResults('${type}')">احسب النتائج</button>
    `;
  }
  document.getElementById('calculator-content').innerHTML = content;

  // Add event listeners for bonus checkboxes only
  if (type === 'stabilization') {
    addBonusCheckboxListeners();
  }
}

function addBonusCheckboxListeners() {
  // Add listeners for bonus questions only
  document.querySelectorAll('.bonus-answer').forEach(checkbox => {
    checkbox.addEventListener('change', function () {
      const resultSpan = this.closest('tr').querySelector('.bonus-result');
      resultSpan.textContent = this.checked ? this.dataset.points : '0';
    });
  });
}

function calculateStabilizationResults(type) {
  let totalResult = 0;
  let bonusScore = 0;

  // Calculate the result for each row (same as cumulative calculator)
  document.querySelectorAll('#calculator-content tbody tr').forEach((row, index) => {
    // Skip bonus table rows
    if (row.closest('.bonus-table')) return;

    let corrections = parseInt(row.querySelector('.corrections').value) || 0;
    let wordOpenings = parseInt(row.querySelector('.word-openings').value) || 0;
    let verseOpenings = parseInt(row.querySelector('.verse-openings').value) || 0;
    let memorizedNoRecitation = parseInt(row.querySelector('.memorized-no-recitation').value) || 0;
    let memorizedWithRecitation = parseInt(row.querySelector('.memorized-with-recitation').value) || 0;

    // Calculate result for this row
    let result = corrections * 2 + wordOpenings * 1 + verseOpenings * 2 + memorizedNoRecitation * 0.1 + memorizedWithRecitation * 0.5;

    // Update result for each row
    row.querySelector('.result').textContent = -result.toFixed(1);

    // Add to total result
    totalResult += result;
  });

  // Calculate bonus questions score
  document.querySelectorAll('.bonus-answer:checked').forEach(checkbox => {
    bonusScore += parseFloat(checkbox.dataset.points);
  });

  // Final total result
  totalResult = 100 - totalResult;

  // Add bonus points
  totalResult += bonusScore;

  // Determine status and emoji
  const status = totalResult >= 90 ? 'ناجح' : '';
  let emoji = '';

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

  // Display results
  const resultContent = `
    <table class="result-table">
      <tbody>
        <tr>
          <td>نوع الاختبار</td>
          <td>اختبار التثبيت</td>
        </tr>
        <tr>
          <td>النتيجة الأساسية</td>
          <td>${(totalResult - bonusScore).toFixed(1)}</td>
        </tr>
        <tr>
          <td>النقاط الإضافية</td>
          <td>+${bonusScore.toFixed(1)}</td>
        </tr>
        <tr>
          <td>النتيجة النهائية</td>
          <td><span id="total-result">${totalResult.toFixed(1)} ${emoji} ${status}</span></td>
        </tr>
        <tr>
          <td>التاريخ</td>
          <td><span id="test-date">${date}</span></td>
        </tr>
      </tbody>
    </table>
  `;

  document.getElementById('result-content').innerHTML = resultContent;

  // Show confetti if score is above 99
  if (totalResult >= 99) {
    showConfetti();
    const resultElement = document.getElementById('total-result');
    resultElement.style.animation = 'resultPulse 0.6s ease-in-out';
  }
}

function openInstructions() {
  window.location.href = 'instructions.html'; // تغيير هذا الرابط إلى رابط صفحة التعليمات الفعلي
}

// Beautiful 3D confetti animation like the image
function showConfetti() {
  const colors = [
    '#FF6B6B', '#FF8E53', '#FF6B35', // Red/Orange shades
    '#4ECDC4', '#45B7D1', '#96CEB4', // Blue/Green shades  
    '#FECA57', '#FF9FF3', '#54A0FF', // Yellow/Pink/Blue
    '#5F27CD', '#00D2D3', '#FF9F43'  // Purple/Cyan/Orange
  ];

  const confettiCount = 120;

  // Create scattered burst across the screen
  for (let i = 0; i < confettiCount; i++) {
    setTimeout(() => {
      createConfettiPiece(colors[Math.floor(Math.random() * colors.length)]);
    }, Math.random() * 1000); // Spread over 1 second
  }
}

function createConfettiPiece(color) {
  const confetti = document.createElement('div');
  const size = Math.random() * 8 + 4; // 4-12px smaller pieces
  const startX = Math.random() * window.innerWidth; // Start from anywhere across screen width
  const startY = -50;

  // Random movement parameters
  const velocityX = (Math.random() - 0.5) * 150; // Less horizontal drift
  const rotationSpeed = Math.random() * 180 + 90; // 90-270 degrees, smoother rotation

  confetti.style.cssText = `
    position: fixed;
    width: ${size}px;
    height: ${size}px;
    background: linear-gradient(45deg, ${color}, ${adjustBrightness(color, 20)});
    border-radius: 3px;
    pointer-events: none;
    z-index: 1000;
    left: ${startX}px;
    top: ${startY}px;
    opacity: 1;
    box-shadow: 0 0 6px rgba(0,0,0,0.1);
    animation: confettiFall3D ${3 + Math.random() * 1.5}s linear forwards;
    transform-origin: center;
  `;

  // Set CSS custom properties for animation
  confetti.style.setProperty('--velocity-x', velocityX + 'px');
  confetti.style.setProperty('--rotation', rotationSpeed + 'deg');

  document.body.appendChild(confetti);

  // Remove confetti after animation
  setTimeout(() => {
    if (confetti.parentNode) {
      confetti.parentNode.removeChild(confetti);
    }
  }, 5000);
}

// Helper function to adjust color brightness
function adjustBrightness(hex, percent) {
  const num = parseInt(hex.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = (num >> 8 & 0x00FF) + amt;
  const B = (num & 0x0000FF) + amt;
  return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
    (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
    (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
}

// Add beautiful 3D confetti CSS animation styles
if (!document.getElementById('confetti-styles')) {
  const style = document.createElement('style');
  style.id = 'confetti-styles';
  style.textContent = `
    @keyframes confettiFall3D {
      0% {
        transform: translate(0, 0) rotate(0deg) rotateY(0deg) scale(1);
        opacity: 1;
      }
      25% {
        transform: translate(calc(var(--velocity-x) * 0.25), 25vh) 
                   rotate(calc(var(--rotation) * 0.25)) rotateY(90deg) scale(1.1);
        opacity: 1;
      }
      50% {
        transform: translate(calc(var(--velocity-x) * 0.5), 50vh) 
                   rotate(calc(var(--rotation) * 0.5)) rotateY(180deg) scale(1);
        opacity: 0.9;
      }
      75% {
        transform: translate(calc(var(--velocity-x) * 0.75), 75vh) 
                   rotate(calc(var(--rotation) * 0.75)) rotateY(270deg) scale(0.9);
        opacity: 0.7;
      }
      100% {
        transform: translate(var(--velocity-x), 110vh) 
                   rotate(var(--rotation)) rotateY(360deg) scale(0.8);
        opacity: 0;
      }
    }
    
    /* Enhanced 3D perspective for confetti container */
    body {
      perspective: 1000px;
      perspective-origin: center top;
    }
    
    /* Result pulse animation */
    @keyframes resultPulse {
      0% {
        transform: scale(1);
        color: inherit;
      }
      50% {
        transform: scale(1.08);
        color: #FF6B6B;
        text-shadow: 0 0 15px rgba(255, 107, 107, 0.6);
      }
      100% {
        transform: scale(1);
        color: inherit;
      }
    }
  `;
  document.head.appendChild(style);
}

