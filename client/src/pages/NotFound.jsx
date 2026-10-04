import { Link } from 'react-router-dom'
import { Button } from 'react-bootstrap'

export default function NotFound() {
  return (
    <div className="text-center py-5">
      <h1 className="mb-3">Page not found</h1>
      <Button as={Link} to="/" variant="warning">Back to home</Button>
    </div>
  )
}
