-- 3D Car Configurator: PostgreSQL schema
-- Requires PostgreSQL 13+ (gen_random_uuid is built in).
-- Run in order: tables reference earlier tables.

BEGIN;

-- =========================================================
-- 1. USERS AND AUTH
-- =========================================================

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name       TEXT        NOT NULL,
    email           TEXT        NOT NULL UNIQUE,
    password_hash   TEXT,                                   -- NULL for Google/Apple-only accounts
    role            TEXT        NOT NULL DEFAULT 'customer'
                    CHECK (role IN ('customer', 'admin')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Google / Apple sign-in links
CREATE TABLE user_identities (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider          TEXT NOT NULL CHECK (provider IN ('google', 'apple')),
    provider_user_id  TEXT NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (provider, provider_user_id)
);

-- Password reset links and refresh (stay-logged-in) tokens
CREATE TABLE auth_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL UNIQUE,                      -- store a hash, never the raw token
    type        TEXT NOT NULL CHECK (type IN ('refresh', 'password_reset')),
    expires_at  TIMESTAMPTZ NOT NULL,
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_auth_tokens_user ON auth_tokens(user_id);

CREATE TABLE addresses (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    first_name  TEXT NOT NULL,
    last_name   TEXT NOT NULL,
    street      TEXT NOT NULL,
    city        TEXT NOT NULL,
    state       TEXT NOT NULL,
    zip         TEXT NOT NULL,
    phone       TEXT,
    is_default  BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_addresses_user ON addresses(user_id);

-- =========================================================
-- 2. CATALOG: BRANDS, VEHICLES, PAINT
-- =========================================================

CREATE TABLE brands (
    id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name  TEXT NOT NULL UNIQUE
);

CREATE TABLE vehicles (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id      UUID NOT NULL REFERENCES brands(id),
    model_name    TEXT NOT NULL,
    slug          TEXT NOT NULL UNIQUE,                    -- used in page URLs
    category      TEXT NOT NULL
                  CHECK (category IN ('Sports', 'Off-road', 'SUV', 'Sedan', 'Electric')),
    body_type     TEXT NOT NULL,                           -- Coupe, SUV, Hatchback...
    drivetrain    TEXT NOT NULL CHECK (drivetrain IN ('AWD', 'RWD', 'FWD', '4WD')),
    base_price    NUMERIC(10,2) NOT NULL CHECK (base_price >= 0),
    model_3d_url  TEXT,                                    -- .glb file; NULL = not uploaded yet
    is_active     BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_vehicles_brand    ON vehicles(brand_id);
CREATE INDEX idx_vehicles_category ON vehicles(category) WHERE is_active;

CREATE TABLE vehicle_media (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id  UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    url         TEXT NOT NULL,
    angle       TEXT,                                      -- front_3q, rear_3q, side, interior...
    sort_order  INT  NOT NULL DEFAULT 0
);
CREATE INDEX idx_vehicle_media_vehicle ON vehicle_media(vehicle_id);

CREATE TABLE paint_options (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id  UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    hex_color   TEXT NOT NULL CHECK (hex_color ~ '^#[0-9A-Fa-f]{6}$'),
    price       NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
    sort_order  INT NOT NULL DEFAULT 0,
    UNIQUE (vehicle_id, name)
);

CREATE TABLE paint_finishes (
    id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name   TEXT NOT NULL UNIQUE,                           -- Gloss, Metallic, Matte
    price  NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0)
);

-- =========================================================
-- 3. PARTS AND COMPATIBILITY
-- =========================================================

CREATE TABLE part_categories (
    id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name  TEXT NOT NULL UNIQUE                             -- Wheels, Exhaust, Brakes...
);

CREATE TABLE parts (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id  UUID NOT NULL REFERENCES part_categories(id),
    name         TEXT NOT NULL,
    part_brand   TEXT NOT NULL,
    price        NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    stock        INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
    is_visual    BOOLEAN NOT NULL DEFAULT true,            -- true = shown in AI preview
    specs        JSONB NOT NULL DEFAULT '{}'::jsonb,       -- material, finish, size, etc.
    is_active    BOOLEAN NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_parts_category ON parts(category_id) WHERE is_active;
CREATE INDEX idx_parts_specs    ON parts USING GIN (specs);

CREATE TABLE part_media (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    part_id     UUID NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
    url         TEXT NOT NULL,
    sort_order  INT  NOT NULL DEFAULT 0
);
CREATE INDEX idx_part_media_part ON part_media(part_id);

-- Which parts fit which cars
CREATE TABLE part_fitment (
    part_id     UUID NOT NULL REFERENCES parts(id)    ON DELETE CASCADE,
    vehicle_id  UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    PRIMARY KEY (part_id, vehicle_id)
);
CREATE INDEX idx_part_fitment_vehicle ON part_fitment(vehicle_id);

-- "Part A requires Part B" / "Part A conflicts with Part B"
CREATE TABLE part_rules (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    part_id          UUID NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
    related_part_id  UUID NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
    rule_type        TEXT NOT NULL CHECK (rule_type IN ('requires', 'conflicts')),
    UNIQUE (part_id, related_part_id),
    CHECK (part_id <> related_part_id)
);

-- =========================================================
-- 4. BUILDS AND AI PREVIEWS
-- =========================================================

CREATE TABLE builds (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vehicle_id       UUID NOT NULL REFERENCES vehicles(id),
    paint_option_id  UUID REFERENCES paint_options(id),
    paint_finish_id  UUID REFERENCES paint_finishes(id),
    name             TEXT NOT NULL,
    status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ordered')),
    share_token      TEXT UNIQUE,                          -- set when the user shares the build
    is_featured      BOOLEAN NOT NULL DEFAULT false,       -- shows in the home page carousel
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_builds_user     ON builds(user_id, updated_at DESC);
CREATE INDEX idx_builds_featured ON builds(is_featured) WHERE is_featured;

CREATE TABLE build_parts (
    build_id  UUID NOT NULL REFERENCES builds(id) ON DELETE CASCADE,
    part_id   UUID NOT NULL REFERENCES parts(id),
    PRIMARY KEY (build_id, part_id)
);

CREATE TABLE ai_previews (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    build_id     UUID NOT NULL REFERENCES builds(id) ON DELETE CASCADE,
    angle        TEXT NOT NULL CHECK (angle IN ('front_3q', 'side', 'rear_3q')),
    config_hash  TEXT NOT NULL,                            -- car + paint + parts + angle fingerprint
    image_url    TEXT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_previews_build ON ai_previews(build_id);
CREATE INDEX idx_ai_previews_hash  ON ai_previews(config_hash);   -- reuse matching images

-- =========================================================
-- 5. CART, PROMOS, ORDERS, PAYMENTS
-- =========================================================

CREATE TABLE promo_codes (
    code         TEXT PRIMARY KEY,                         -- e.g. BUILD10
    percent_off  INT NOT NULL CHECK (percent_off BETWEEN 1 AND 100),
    is_active    BOOLEAN NOT NULL DEFAULT true,
    expires_at   TIMESTAMPTZ
);

CREATE TABLE carts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    promo_code  TEXT REFERENCES promo_codes(code),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE cart_items (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_id   UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
    part_id   UUID NOT NULL REFERENCES parts(id),
    build_id  UUID REFERENCES builds(id) ON DELETE SET NULL,
    quantity  INT  NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 4),
    UNIQUE (cart_id, part_id)
);

CREATE TABLE orders (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number      TEXT NOT NULL UNIQUE,                -- e.g. #1048, shown to customers
    user_id           UUID NOT NULL REFERENCES users(id),
    build_id          UUID REFERENCES builds(id) ON DELETE SET NULL,
    promo_code        TEXT REFERENCES promo_codes(code),
    status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),
    delivery_method   TEXT NOT NULL CHECK (delivery_method IN ('standard', 'express', 'installer')),
    shipping_address  JSONB NOT NULL,                      -- copy of the address at checkout
    subtotal          NUMERIC(10,2) NOT NULL,
    discount          NUMERIC(10,2) NOT NULL DEFAULT 0,
    shipping          NUMERIC(10,2) NOT NULL DEFAULT 0,
    tax               NUMERIC(10,2) NOT NULL DEFAULT 0,
    total             NUMERIC(10,2) NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_orders_user   ON orders(user_id, created_at DESC);
CREATE INDEX idx_orders_status ON orders(status, created_at DESC);

CREATE TABLE order_items (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    part_id     UUID REFERENCES parts(id) ON DELETE SET NULL,
    part_name   TEXT NOT NULL,                             -- copy at time of order
    unit_price  NUMERIC(10,2) NOT NULL,                    -- copy at time of order
    quantity    INT NOT NULL CHECK (quantity >= 1)
);
CREATE INDEX idx_order_items_order ON order_items(order_id);

CREATE TABLE order_status_history (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    status      TEXT NOT NULL,
    changed_by  UUID REFERENCES users(id) ON DELETE SET NULL,   -- admin who changed it
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_order_status_history_order ON order_status_history(order_id, created_at);

CREATE TABLE payments (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id      UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    provider      TEXT NOT NULL,                           -- stripe, paypal, mock...
    provider_ref  TEXT,                                    -- payment ID from the provider
    status        TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
    amount        NUMERIC(10,2) NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_order ON payments(order_id);

COMMIT;
