// Regex Tester Widget
document.addEventListener('DOMContentLoaded', () => {
  const patternInput = document.getElementById('regex-pattern');
  const flagsInput = document.getElementById('regex-flags');
  const testInput = document.getElementById('regex-test-string');
  const resultDisplay = document.getElementById('regex-result');
  const matchCount = document.getElementById('regex-match-count');

  if (!patternInput || !testInput || !resultDisplay) return;

  function updateRegex() {
    const pattern = patternInput.value;
    const flags = flagsInput.value;
    const testString = testInput.value;

    if (!pattern) {
      resultDisplay.innerHTML = '<span class="regex-placeholder">Enter a pattern to test...</span>';
      matchCount.textContent = '0 matches';
      return;
    }

    try {
      const regex = new RegExp(pattern, flags);
      const isGlobal = flags.includes('g');
      
      if (!isGlobal) {
        const match = regex.exec(testString);
        if (match) {
          highlightMatches([{ index: match.index, length: match[0].length }], testString);
          matchCount.textContent = '1 match';
        } else {
          resultDisplay.textContent = testString;
          matchCount.textContent = '0 matches';
        }
      } else {
        const matches = [];
        let match;
        // prevent infinite loops with global regex that matches empty string
        if (pattern === '^' || pattern === '$' || pattern === '') {
             throw new Error('Regex matches empty string infinitely');
        }
        while ((match = regex.exec(testString)) !== null) {
          matches.push({ index: match.index, length: match[0].length });
          if (regex.lastIndex === match.index) {
            regex.lastIndex++; // advance to avoid infinite loop
          }
        }
        
        if (matches.length > 0) {
          highlightMatches(matches, testString);
          matchCount.textContent = `${matches.length} match${matches.length === 1 ? '' : 'es'}`;
        } else {
          resultDisplay.textContent = testString;
          matchCount.textContent = '0 matches';
        }
      }
    } catch (e) {
      resultDisplay.innerHTML = `<span class="regex-error">Invalid Regex: ${e.message}</span>`;
      matchCount.textContent = 'Error';
    }
  }

  function highlightMatches(matches, text) {
    let html = '';
    let lastIndex = 0;
    
    matches.forEach(m => {
      html += escapeHtml(text.substring(lastIndex, m.index));
      html += `<mark class="regex-highlight">${escapeHtml(text.substring(m.index, m.index + m.length))}</mark>`;
      lastIndex = m.index + m.length;
    });
    html += escapeHtml(text.substring(lastIndex));
    
    // Replace newlines with br for correct display
    resultDisplay.innerHTML = html.replace(/\n/g, '<br>');
  }

  function escapeHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  patternInput.addEventListener('input', updateRegex);
  flagsInput.addEventListener('input', updateRegex);
  testInput.addEventListener('input', updateRegex);
  
  // Sync scrolling between textarea and result display
  testInput.addEventListener('scroll', () => {
    resultDisplay.scrollTop = testInput.scrollTop;
  });
});
