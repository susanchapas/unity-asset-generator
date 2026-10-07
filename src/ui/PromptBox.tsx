import { useState } from 'react'

interface Props {
  busy: boolean
  error: string | null
  onSubmit(prompt: string): void
}

export function PromptBox({ busy, error, onSubmit }: Props) {
  const [prompt, setPrompt] = useState('')
  const canSubmit = !busy && prompt.trim().length > 0

  const submit = () => {
    if (canSubmit) onSubmit(prompt.trim())
  }

  return (
    <form
      className="panel"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <label htmlFor="prompt">Prompt</label>
      <textarea
        id="prompt"
        rows={4}
        value={prompt}
        placeholder="A mossy stone well with a wooden bucket"
        disabled={busy}
        onChange={(event) => setPrompt(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault()
            submit()
          }
        }}
      />
      <button type="submit" className="primary" disabled={!canSubmit}>
        {busy ? 'Generating…' : 'Generate'}
      </button>
      <p className="error" role="alert" hidden={!error}>
        {error}
      </p>
    </form>
  )
}
