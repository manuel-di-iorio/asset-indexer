export function showModal(title, bodyHtml, footerHtml) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  document.getElementById('modal-footer').innerHTML = footerHtml;
  document.getElementById('modal-overlay').style.display = 'flex';

  document.getElementById('modal-close').onclick = hideModal;
  document.getElementById('modal-overlay').onclick = (e) => {
    if (e.target === document.getElementById('modal-overlay')) hideModal();
  };
}

export function hideModal() {
  document.getElementById('modal-overlay').style.display = 'none';
}
