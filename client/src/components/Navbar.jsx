import { Link, NavLink, useNavigate } from 'react-router-dom'
import { Navbar as BsNavbar, Nav, NavDropdown, Container, Badge, Button } from 'react-bootstrap'
import { useAuth } from '../context/AuthContext.jsx'
import { useCart } from '../context/CartContext.jsx'

export default function Navbar() {
  const { user, isAdmin, logout } = useAuth()
  const { count } = useCart()
  const navigate = useNavigate()

  return (
    <BsNavbar expand="md" bg="body" sticky="top" className="border-bottom" collapseOnSelect>
      <Container fluid="xl">
        <BsNavbar.Brand as={Link} to="/" className="fw-bold">[BRAND]</BsNavbar.Brand>
        <BsNavbar.Toggle aria-controls="main-nav" />
        <BsNavbar.Collapse id="main-nav">
          {/* ms-auto pushes links right; text-end keeps the phone menu under the button */}
          <Nav className="ms-auto align-items-md-center text-end">
            <Nav.Link as={NavLink} to="/catalog" eventKey="catalog">Car catalog</Nav.Link>
            <Nav.Link as={NavLink} to="/parts" eventKey="parts">Parts marketplace</Nav.Link>
            <Nav.Link as={NavLink} to="/builds" eventKey="builds">My builds</Nav.Link>
            {isAdmin && <Nav.Link as={NavLink} to="/admin" eventKey="admin">Admin</Nav.Link>}
            <Nav.Link as={NavLink} to="/cart" eventKey="cart">
              Cart {count > 0 && <Badge bg="warning" text="dark" pill>{count}</Badge>}
            </Nav.Link>
            {user ? (
              <NavDropdown title={user.name.split(' ')[0]} id="account-menu" align="end">
                <NavDropdown.Item as={Link} to="/account" eventKey="account">My account</NavDropdown.Item>
                <NavDropdown.Item as={Link} to="/builds" eventKey="builds2">My builds</NavDropdown.Item>
                <NavDropdown.Divider />
                <NavDropdown.Item eventKey="logout" onClick={() => { logout(); navigate('/') }}>Log out</NavDropdown.Item>
              </NavDropdown>
            ) : (
              <Nav.Item className="ms-md-2 py-2 py-md-0">
                <Button as={Link} to="/login" variant="warning" size="sm">Log in</Button>
              </Nav.Item>
            )}
          </Nav>
        </BsNavbar.Collapse>
      </Container>
    </BsNavbar>
  )
}
