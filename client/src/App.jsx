import { Routes, Route } from 'react-router-dom'
import { Container } from 'react-bootstrap'
import Navbar from './components/Navbar.jsx'
import { RequireAuth, RequireAdmin } from './components/Guards.jsx'
import Home from './pages/Home.jsx'
import Catalog from './pages/Catalog.jsx'
import Configurator from './pages/Configurator.jsx'
import Marketplace from './pages/Marketplace.jsx'
import Login from './pages/Login.jsx'
import ResetPassword from './pages/ResetPassword.jsx'
import MyBuilds from './pages/MyBuilds.jsx'
import SharedBuild from './pages/SharedBuild.jsx'
import Cart from './pages/Cart.jsx'
import Account from './pages/Account.jsx'
import Admin from './pages/Admin.jsx'
import NotFound from './pages/NotFound.jsx'

export default function App() {
  return (
    <div className="d-flex flex-column min-vh-100">
      <Navbar />
      <Container fluid="xl" as="main" className="py-4 flex-grow-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/configure/:slug" element={<Configurator />} />
          <Route path="/parts" element={<Marketplace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/builds" element={<RequireAuth><MyBuilds /></RequireAuth>} />
          <Route path="/shared/:token" element={<SharedBuild />} />
          <Route path="/cart" element={<RequireAuth><Cart /></RequireAuth>} />
          <Route path="/account" element={<RequireAuth><Account /></RequireAuth>} />
          <Route path="/admin" element={<RequireAdmin><Admin /></RequireAdmin>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Container>
      <footer className="border-top py-4 mt-5">
        <Container fluid="xl" className="d-flex flex-wrap justify-content-between gap-2 small text-body-secondary">
          <span>[BRAND] · Personal project</span>
          <span>3D models by their Sketchfab authors.</span>
        </Container>
      </footer>
    </div>
  )
}
