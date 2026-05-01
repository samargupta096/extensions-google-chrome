/**
 * ListDrag Utility — Handles drag-and-drop reordering for widget lists
 */
class ListDrag {
  /**
   * Initialize drag events on a list
   * @param {HTMLElement} listElement - The <ul> or <ol> element
   * @param {Array} dataArray - The source data array (will be mutated)
   * @param {Function} onUpdate - Callback after reordering (save & render)
   */
  static init(listElement, dataArray, onUpdate) {
    let draggedIndex = null;
    const items = listElement.querySelectorAll('li');

    items.forEach((li, index) => {
      // Make sure the handle is the only thing that initiates the drag
      const handle = li.querySelector('.list-item-handle');
      if (!handle) return;

      li.setAttribute('draggable', 'true');
      li.dataset.index = index;

      li.addEventListener('dragstart', (e) => {
        // Stop propagation so the widget's drag logic doesn't interfere
        e.stopPropagation();
        
        // Only drag if the handle was the target
        if (e.target.closest('.list-item-handle') || e.target === li) {
          draggedIndex = index;
          li.classList.add('dragging-item');
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', index);
          
          // Firefox ghost image fix
          setTimeout(() => {
            li.style.opacity = '0.4';
          }, 0);
        } else {
          e.preventDefault();
        }
      });

      li.addEventListener('dragend', (e) => {
        e.stopPropagation();
        li.classList.remove('dragging-item');
        li.style.opacity = '1';
        items.forEach(item => item.classList.remove('drag-over-item'));
      });

      li.addEventListener('dragover', (e) => {
        e.stopPropagation();
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        const target = e.target.closest('li');
        if (target && target !== li) {
          target.classList.add('drag-over-item');
        }
      });

      li.addEventListener('dragleave', (e) => {
        const target = e.target.closest('li');
        if (target) {
          target.classList.remove('drag-over-item');
        }
      });

      li.addEventListener('drop', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const targetLi = e.target.closest('li');
        if (!targetLi) return;

        const targetIndex = parseInt(targetLi.dataset.index);
        
        if (draggedIndex !== null && draggedIndex !== targetIndex) {
          // Reorder the data array
          const [movedItem] = dataArray.splice(draggedIndex, 1);
          dataArray.splice(targetIndex, 0, movedItem);
          
          // Trigger the update callback (save to storage + re-render)
          onUpdate();
        }
        
        draggedIndex = null;
      });
    });
  }
}

window.ListDrag = ListDrag;
