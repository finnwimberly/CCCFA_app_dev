// controls/collapsible.js

export function setupCollapsibles() {
  const headers = document.querySelectorAll('.collapsible-header');
  headers.forEach(header => {
    const icon = header.querySelector('.collapse-icon');
    const content = header.nextElementSibling;
    if (!content) return;
    content.classList.add('expanded');
    header.addEventListener('click', function() {
      if (icon) icon.classList.toggle('collapsed');
      content.classList.toggle('expanded');
    });
  });
}


