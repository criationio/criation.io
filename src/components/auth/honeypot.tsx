/**
 * Campo honeypot anti-bot. Renderiza fora da tela via posicionamento
 * absoluto (NAO display:none, que bots detectam). Bots automatizados
 * preenchem todos os campos do form e o backend rejeita silenciosamente
 * quando este vem nao-vazio.
 */
export function HoneypotField() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: '-9999px',
        top: 'auto',
        width: '1px',
        height: '1px',
        overflow: 'hidden',
      }}
    >
      <label htmlFor="honeypot-field">Nao preencher</label>
      <input
        id="honeypot-field"
        type="text"
        name="honeypot"
        tabIndex={-1}
        autoComplete="off"
        defaultValue=""
      />
    </div>
  )
}
