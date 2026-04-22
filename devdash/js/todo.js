let todos = [];

document.addEventListener('DOMContentLoaded', () => {
  const todoInput = document.getElementById('todo-input');
  const addTodoBtn = document.getElementById('add-todo-btn');
  const todoList = document.getElementById('todo-list');

  // Load from storage
  chrome.storage.local.get(['todos'], (result) => {
    if (result.todos) {
      todos = result.todos;
      renderTodos();
    }
  });

  function saveTodos() {
    chrome.storage.local.set({ todos: todos });
  }

  function renderTodos() {
    todoList.innerHTML = '';
    todos.forEach((todo, index) => {
      const li = document.createElement('li');
      if (todo.completed) {
        li.classList.add('completed');
      }

      const textSpan = document.createElement('span');
      textSpan.className = 'item-text';
      textSpan.textContent = todo.text;
      textSpan.addEventListener('click', () => {
        todos[index].completed = !todos[index].completed;
        saveTodos();
        renderTodos();
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-btn';
      deleteBtn.innerHTML = '&times;';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        todos.splice(index, 1);
        saveTodos();
        renderTodos();
      });

      li.appendChild(textSpan);
      li.appendChild(deleteBtn);
      todoList.appendChild(li);
    });
  }

  function addTodo() {
    const text = todoInput.value.trim();
    if (text) {
      todos.push({ text: text, completed: false });
      todoInput.value = '';
      saveTodos();
      renderTodos();
    }
  }

  addTodoBtn.addEventListener('click', addTodo);
  todoInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addTodo();
  });
});
