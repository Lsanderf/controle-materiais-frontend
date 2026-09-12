import { useEffect, useRef, useState } from 'react';
import MaterialForm from './MaterialForm';

export default function NotaFiscalMaterialDialog({ item, onCreated, onCancel }) {
  const dialogRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const productDescription = item.origemXml?.descricaoProduto ?? '';

  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const viewport = window.visualViewport;

    function fitViewport() {
      dialog.style.setProperty('--material-dialog-height', `${viewport?.height ?? window.innerHeight}px`);
      dialog.style.setProperty('--material-dialog-top', `${viewport?.offsetTop ?? 0}px`);
    }

    fitViewport();
    viewport?.addEventListener('resize', fitViewport);
    viewport?.addEventListener('scroll', fitViewport);
    dialog.showModal();
    document.body.style.overflow = 'hidden';

    return () => {
      viewport?.removeEventListener('resize', fitViewport);
      viewport?.removeEventListener('scroll', fitViewport);
      document.body.style.overflow = previousOverflow;
      dialog.close();
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="material-create-dialog"
      aria-modal="true"
      aria-labelledby="material-create-title"
      aria-describedby="material-create-description"
      onCancel={(event) => {
        event.preventDefault();
        if (!saving) onCancel();
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const controls = [...event.currentTarget.querySelectorAll(
          'input:not(:disabled), textarea:not(:disabled), button:not(:disabled)',
        )];
        const first = controls[0];
        const last = controls.at(-1);
        if (!first) {
          event.preventDefault();
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
    >
      <header className="material-create-header">
        <h2 id="material-create-title">Novo material</h2>
        <p id="material-create-description">
          O estoque inicial será zero. A entrada ocorrerá ao confirmar a nota fiscal.
        </p>
      </header>
      <MaterialForm
        initialValues={{
          nome: productDescription.slice(0, 100),
          descricao: productDescription.slice(0, 500),
        }}
        onSaved={onCreated}
        onCancel={onCancel}
        onSavingChange={setSaving}
      />
    </dialog>
  );
}
