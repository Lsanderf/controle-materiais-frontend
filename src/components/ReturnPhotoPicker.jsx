import { useEffect, useId, useState } from 'react';
import { ErrorMessage } from './Feedback';

export default function ReturnPhotoPicker({ file, onChange, disabled }) {
  const id = useId();
  const [preview, setPreview] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!file) {
      setPreview('');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function selectPhoto(event) {
    const selected = event.target.files?.[0];
    event.target.value = '';
    if (!selected) return;
    setError(null);
    if (!['image/png', 'image/jpeg'].includes(selected.type)) {
      setError(new Error('Escolha uma foto PNG ou JPEG.'));
      return;
    }
    onChange(selected);
  }

  return (
    <section className="return-photo-picker" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`}>Foto do material (obrigatória)</h3>
      <p>Adicione uma foto para concluir a devolução.</p>
      <ErrorMessage error={error} />
      <div className="return-photo-actions">
        <label className={`button button-secondary${disabled ? ' is-disabled' : ''}`}>
          {file ? 'Escolher outra foto' : 'Adicionar foto'}
          <input type="file" className="visually-hidden-file-input"
            accept="image/png,image/jpeg" onChange={selectPhoto} disabled={disabled}
            aria-label="Escolher foto da galeria" />
        </label>
        <label className={`button button-secondary${disabled ? ' is-disabled' : ''}`}>
          Usar câmera
          <input type="file" className="visually-hidden-file-input"
            accept="image/png,image/jpeg" capture="environment"
            onChange={selectPhoto} disabled={disabled} aria-label="Tirar foto do material" />
        </label>
      </div>
      {preview && (
        <div className="return-photo-preview">
          <img src={preview} alt="Prévia da foto do material devolvido" />
          <button className="button button-secondary" type="button" disabled={disabled}
            onClick={() => { onChange(null); setError(null); }}>
            Remover foto
          </button>
        </div>
      )}
    </section>
  );
}
