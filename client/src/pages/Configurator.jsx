import { useEffect, useMemo, useState } from 'react'
import { useParams, Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import api, { errorText } from '../api/client.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useCart } from '../context/CartContext.jsx'
import CarViewer from '../components/CarViewer.jsx'
import PaintPicker from '../components/PaintPicker.jsx'
import PartList from '../components/PartList.jsx'
import BuildSummary from '../components/BuildSummary.jsx'
import Modal, { ModalActions } from '../components/Modal.jsx'
import CategoryPills from '../components/CategoryPills.jsx'
import { Card, Form, Button } from 'react-bootstrap'
import { togglePart } from '../lib/rules.js'
import { money } from '../lib/format.js'

const TAB_ORDER = ['Wheels', 'Body kits', 'Spoilers', 'Exhaust', 'Brakes', 'Suspension', 'Air filters', 'Performance']
const snapshot = (paintId, finishId, selected) => JSON.stringify([paintId, finishId, [...selected].sort()])

export default function Configurator() {
  const { slug } = useParams()
  const [params] = useSearchParams()
  const buildParam = params.get('build')
  const navigate = useNavigate()
  const location = useLocation()
  const { user, ready } = useAuth()
  const { addBuild } = useCart()

  const [car, setCar] = useState(null)
  const [parts, setParts] = useState([])
  const [rules, setRules] = useState([])
  const [error, setError] = useState('')

  const [tab, setTab] = useState('Paint')
  const [paintId, setPaintId] = useState(null)
  const [finishId, setFinishId] = useState(null)
  const [selected, setSelected] = useState(new Set())
  const [quote, setQuote] = useState(null)
  const [quoteError, setQuoteError] = useState('')

  const [saved, setSaved] = useState(null)          // the saved build, if any
  const [savedSnap, setSavedSnap] = useState('')
  const [askName, setAskName] = useState(null)      // action waiting for a build name
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  // Load the car, the parts that fit it, and (if ?build=) the saved build
  useEffect(() => {
    if (buildParam && !ready) return
    let cancelled = false
    setCar(null); setError(''); setNotice(''); setTab('Paint')
    ;(async () => {
      try {
        const [c, p] = await Promise.all([api.get(`/vehicles/${slug}`), api.get(`/vehicles/${slug}/parts`)])
        if (cancelled) return
        let pId = c.data.paints[0]?.id || null
        let fId = c.data.finishes[0]?.id || null
        let sel = new Set()
        let build = null
        if (buildParam && user) {
          try {
            build = (await api.get(`/builds/${buildParam}`)).data
            if (build.vehicle_id === c.data.id) {
              pId = build.paint_option_id || pId
              fId = build.paint_finish_id || fId
              sel = new Set(build.parts.map((x) => x.id).filter((id) => p.data.parts.some((pp) => pp.id === id)))
            } else build = null
          } catch { build = null }
        }
        // Restore choices made before being sent to the login page
        const pending = sessionStorage.getItem(`pendingBuild:${slug}`)
        if (!build && pending) {
          sessionStorage.removeItem(`pendingBuild:${slug}`)
          try {
            const saved = JSON.parse(pending)
            if (c.data.paints.some((x) => x.id === saved.paintId)) pId = saved.paintId
            if (c.data.finishes.some((x) => x.id === saved.finishId)) fId = saved.finishId
            sel = new Set(saved.parts.filter((id) => p.data.parts.some((pp) => pp.id === id)))
          } catch { /* ignore bad data */ }
        }
        setCar(c.data); setParts(p.data.parts); setRules(p.data.rules)
        setPaintId(pId); setFinishId(fId); setSelected(sel)
        setSaved(build); setSavedSnap(build ? snapshot(pId, fId, sel) : '')
      } catch {
        if (!cancelled) setError('Car not found.')
      }
    })()
    return () => { cancelled = true }
  }, [slug, buildParam, ready, user])

  // Ask the server for the price whenever the build changes
  useEffect(() => {
    if (!car) return
    const timer = setTimeout(() => {
      api.post('/quote', { vehicleId: car.id, paintOptionId: paintId, finishId, partIds: [...selected] })
        .then((res) => { setQuote(res.data); setQuoteError('') })
        .catch((err) => setQuoteError(errorText(err, 'Could not update price')))
    }, 150)
    return () => clearTimeout(timer)
  }, [car, paintId, finishId, selected])

  const tabs = useMemo(() => ['Paint', ...TAB_ORDER.filter((c) => parts.some((p) => p.category === c))], [parts])
  const dirty = saved ? snapshot(paintId, finishId, selected) !== savedSnap : true
  const ordered = saved?.status === 'ordered'

  // Makes sure the current setup is saved, then returns the saved build
  const ensureSaved = async (action) => {
    if (!user) {
      sessionStorage.setItem(`pendingBuild:${slug}`, JSON.stringify({ paintId, finishId, parts: [...selected] }))
      navigate('/login', { state: { from: location.pathname + location.search } })
      return null
    }
    const body = { paintOptionId: paintId, finishId, partIds: [...selected] }
    if (saved && (!dirty || ordered)) return saved
    if (saved) {
      const res = await api.put(`/builds/${saved.id}`, body)
      setSaved(res.data); setSavedSnap(snapshot(paintId, finishId, selected))
      return res.data
    }
    setName(`My ${car.model_name}`)
    setAskName(action)
    return null
  }

  const runAction = async (action, build) => {
    setNotice('')
    if (action === 'save') setNotice('Build saved to My builds.')
    if (action === 'cart') {
      const cart = await addBuild(build.id)
      setNotice(`Parts added. Your cart now has ${cart.count} item${cart.count === 1 ? '' : 's'}.`)
    }
    if (action === 'share') {
      const res = await api.post(`/builds/${build.id}/share`)
      try { await navigator.clipboard.writeText(res.data.url); setNotice('Share link copied to your clipboard.') }
      catch { setNotice(`Share link: ${res.data.url}`) }
    }
  }

  const act = async (action) => {
    setBusy(true); setNotice('')
    try {
      const build = await ensureSaved(action)
      if (build) await runAction(action, build)
    } catch (err) {
      setNotice(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  // First save: create the build with the chosen name, then continue the action
  const createBuild = async (e) => {
    e.preventDefault()
    const action = askName
    setAskName(null); setBusy(true)
    try {
      const res = await api.post('/builds', { vehicleId: car.id, paintOptionId: paintId, finishId, partIds: [...selected], name })
      setSaved(res.data); setSavedSnap(snapshot(paintId, finishId, selected))
      navigate(`/configure/${slug}?build=${res.data.id}`, { replace: true })
      await runAction(action, res.data)
    } catch (err) {
      setNotice(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  if (error) return <p>{error} <Link to="/catalog">Back to catalog</Link></p>
  if (!car) return <p className="status">Loading…</p>

  const paint = car.paints.find((p) => p.id === paintId)
  const finish = car.finishes.find((f) => f.id === finishId)
  const countIn = (cat) => parts.filter((p) => p.category === cat && selected.has(p.id)).length

  return (
    <>
      <div className="small text-body-secondary"><Link to="/catalog" className="link-warning">Catalog</Link> / {car.category}</div>
      <div className="d-flex flex-wrap justify-content-between align-items-baseline gap-2">
        <h1 className="mb-0">{car.brand} {car.model_name}</h1>
        <span className="text-body-secondary">From {money(car.base_price)} · {car.drivetrain}</span>
      </div>

      <div className="config-layout">
        <section className="config-main">
          <div className="viewer-wrap">
            <span className="viewer-note">Stock car · your parts appear in the AI preview</span>
            <CarViewer modelUrl={car.model_3d_url} title={`${car.brand} ${car.model_name}`} />
          </div>
          {car.model_source_url && (
            <p className="small text-body-secondary mt-2">3D model: <a href={car.model_source_url} target="_blank" rel="noreferrer" className="link-warning">view on Sketchfab</a></p>
          )}
        </section>

        <aside className="config-side">
          <Card body>
            <div className="mb-3">
              <CategoryPills
                items={tabs.map((t) => [t, t !== 'Paint' && countIn(t) > 0 ? `${t} (${countIn(t)})` : t])}
                value={tab} onChange={setTab} />
            </div>
            {tab === 'Paint' ? (
              <PaintPicker paints={car.paints} finishes={car.finishes} paintId={paintId} finishId={finishId} onPaint={setPaintId} onFinish={setFinishId} />
            ) : (
              <PartList
                category={tab}
                parts={parts.filter((p) => p.category === tab)}
                allParts={parts}
                rules={rules}
                selected={selected}
                onToggle={(id) => setSelected((s) => togglePart(id, s, parts, rules))}
              />
            )}
            <Link className="small link-warning d-block mt-3" to={`/parts?vehicle=${car.slug}`}>Browse all compatible parts in the marketplace</Link>
          </Card>

          <BuildSummary
            quote={quote} error={quoteError}
            paintLabel={`${paint?.name || ''}, ${finish?.name || ''}`}
            buildName={saved?.name} dirty={dirty} ordered={ordered} busy={busy} notice={notice}
            onSave={() => act('save')}
            onCart={() => act('cart')} onShare={() => act('share')}
          />
        </aside>
      </div>

      {askName && (
        <Modal title="Name your build" onClose={() => setAskName(null)}>
          <Form onSubmit={createBuild}>
            <Form.Group className="mb-3" controlId="build-name">
              <Form.Label>Build name</Form.Label>
              <Form.Control value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus />
            </Form.Group>
            <ModalActions>
              <Button variant="outline-light" onClick={() => setAskName(null)}>Cancel</Button>
              <Button type="submit" variant="warning" disabled={!name.trim()}>Save and continue</Button>
            </ModalActions>
          </Form>
        </Modal>
      )}

    </>
  )
}
