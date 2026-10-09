import './maintenance.css'

export default function App() {
  return (
    <main className="maintenance-page">
      <div className="maintenance-glow maintenance-glow--left" aria-hidden="true" />
      <div className="maintenance-glow maintenance-glow--right" aria-hidden="true" />

      <section className="maintenance-card" aria-labelledby="maintenance-title">
        <div className="maintenance-mark" aria-hidden="true">
          <span>匕</span>
        </div>
        <p className="maintenance-eyebrow">SYSTEM NOTICE</p>
        <h1 id="maintenance-title">当前项目技术升级中</h1>
        <div className="maintenance-divider" aria-hidden="true">
          <span />
          <i />
          <span />
        </div>
        <p className="maintenance-message">给您造成的不便敬请谅解</p>
        <p className="maintenance-footnote">服务恢复后即可正常访问，感谢您的耐心等待。</p>
      </section>
    </main>
  )
}
