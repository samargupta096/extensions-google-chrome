let goals = [];

document.addEventListener('DOMContentLoaded', () => {
  const goalInput = document.getElementById('goal-input');
  const addGoalBtn = document.getElementById('add-goal-btn');
  const goalsList = document.getElementById('goals-list');

  // Load from storage
  chrome.storage.local.get(['goals'], (result) => {
    if (result.goals) {
      goals = result.goals;
      renderGoals();
    }
  });

  function saveGoals() {
    chrome.storage.local.set({ goals: goals });
  }

  function renderGoals() {
    goalsList.innerHTML = '';
    goals.forEach((goal, index) => {
      const li = document.createElement('li');
      if (goal.completed) {
        li.classList.add('completed');
      }

      const textSpan = document.createElement('span');
      textSpan.className = 'item-text';
      textSpan.textContent = goal.text;
      textSpan.addEventListener('click', () => {
        goals[index].completed = !goals[index].completed;
        saveGoals();
        renderGoals();
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-btn';
      deleteBtn.innerHTML = '&times;';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        goals.splice(index, 1);
        saveGoals();
        renderGoals();
      });

      li.appendChild(textSpan);
      li.appendChild(deleteBtn);
      goalsList.appendChild(li);
    });
  }

  function addGoal() {
    const text = goalInput.value.trim();
    if (text) {
      goals.push({ text: text, completed: false });
      goalInput.value = '';
      saveGoals();
      renderGoals();
    }
  }

  addGoalBtn.addEventListener('click', addGoal);
  goalInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addGoal();
  });
});
