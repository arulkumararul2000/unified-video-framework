# Player UI Visibility API (playerId-driven)

This document defines an admin-friendly API for dynamically controlling per-player UI using a playerId. The WebPlayer fetches a JSON config using `playerId` and applies it. Everything defaults to visible and the default layout if not configured.


## Controls you can toggle

All keys are booleans (true = visible, false = hidden). Omit a key to fall back to true.

- cast: Cast button + Stop Casting
- settings: Settings button + Settings menu
- share: Share button
- fullscreen: Fullscreen button
- pip: Picture-in-Picture button
- playlist: Playlist button
- skipBack: Back 10s button
- skipForward: Forward 10s button
- volume: Volume button + Volume panel
- time: Time display (00:00 / 00:00)
- qualityBadge: Quality badge (HD/AUTO)
- seekbar: Progress bar section (bar, handle, tooltip)


## DOM ID mapping (WebPlayer)

Used internally to show/hide elements.

- cast -> uvf-cast-btn, uvf-stop-cast-btn
- settings -> uvf-settings-btn, uvf-settings-menu
- share -> uvf-share-btn
- fullscreen -> uvf-fullscreen-btn
- pip -> uvf-pip-btn
- playlist -> uvf-playlist-btn
- skipBack -> uvf-skip-back
- skipForward -> uvf-skip-forward
- volume -> uvf-volume-btn, uvf-volume-panel
- time -> uvf-time-display
- qualityBadge -> uvf-quality-badge
- seekbar -> uvf-progress-section, uvf-progress-bar


## API design

Single source of truth per `playerId`. The player only uses these endpoints—no other fallbacks.

- GET /player-ui/{playerId}
  - Returns JSON visibility+layout for that playerId
  - 200 with JSON if configured; 404 if not configured
- PUT /player-ui/{playerId}
  - Admin upsert of the visibility+layout JSON
  - 200 with the saved JSON


## Response format (GET)

```json
{
  "playerId": "landing_hero",
  "v": 1,
  "visibility": {
    "cast": false,
    "settings": true,
    "share": false,
    "fullscreen": true,
    "pip": false,
    "playlist": false,
    "skipBack": true,
    "skipForward": true,
    "volume": true,
    "time": true,
    "qualityBadge": true,
    "seekbar": true
  },
  "layout": {
    "template": "classic", 
    "regions": {
      "topLeft": ["playlist"],
      "topRight": ["cast", "share"],
      "bottomLeft": ["playPause", "skipBack", "skipForward"],
      "bottomRight": ["settings", "pip", "fullscreen"],
      "centerOverlay": ["centerPlay"]
    },
    "order": {
      "playPause": 10,
      "skipBack": 20,
      "skipForward": 30,
      "settings": 10,
      "pip": 20,
      "fullscreen": 30
    },
    "breakpoints": {
      "desktop": {
        "regions": {
          "topRight": ["cast", "share"],
          "bottomRight": ["settings", "pip", "fullscreen"]
        }
      },
      "tablet": {
        "regions": {
          "topRight": ["cast"],
          "bottomRight": ["settings", "fullscreen"]
        }
      },
      "mobile": {
        "regions": {
          "topRight": [],
          "bottomRight": ["settings"],
          "topLeft": []
        },
        "overrides": {
          "share": { "visible": false },
          "pip": { "visible": false }
        }
      }
    },
    "overrides": {
      "qualityBadge": { "region": "bottomRight", "order": 5 },
      "time": { "region": "bottomLeft", "order": 40 },
      "seekbar": { "region": "bottomFull", "order": 1 }
    },
    "style": {
      "gap": 10,
      "padding": 16,
      "align": "space-between"
    }
  },
  "meta": {
    "updatedAt": "2025-09-02T09:00:00.000Z",
    "updatedBy": "admin@example.com"
  }
}
```

Notes
- `visibility` and `layout` may omit keys; omitted visibility keys are treated as `true`; omitted layout falls back to the default template.
- `v` is a schema/version number (start with `1`).


## Request format (PUT)

Admin panels send the parts they modify; backend stores them.

```json
{
  "visibility": {
    "cast": false,
    "share": false,
    "pip": false,
    "seekbar": true
  },
  "layout": {
    "template": "classic",
    "overrides": {
      "fullscreen": { "region": "topRight", "order": 1 },
      "settings": { "region": "bottomRight", "order": 10 }
    },
    "breakpoints": {
      "mobile": {
        "regions": {
          "topRight": [],
          "bottomRight": ["settings"]
        },
        "overrides": {
          "fullscreen": { "visible": false }
        }
      }
    }
  }
}
```

A successful upsert returns the complete stored object.


## JSON Schema (validation)

```json
{
  "type": "object",
  "properties": {
    "playerId": { "type": "string" },
    "v": { "type": "integer" },
    "visibility": {
      "type": "object",
      "properties": {
        "cast": { "type": "boolean" },
        "settings": { "type": "boolean" },
        "share": { "type": "boolean" },
        "fullscreen": { "type": "boolean" },
        "pip": { "type": "boolean" },
        "playlist": { "type": "boolean" },
        "skipBack": { "type": "boolean" },
        "skipForward": { "type": "boolean" },
        "volume": { "type": "boolean" },
        "time": { "type": "boolean" },
        "qualityBadge": { "type": "boolean" },
        "seekbar": { "type": "boolean" }
      },
      "additionalProperties": false
    },
    "layout": {
      "type": "object",
      "properties": {
        "template": { "type": "string" },
        "regions": {
          "type": "object",
          "description": "Map of regionName -> array of control keys",
          "additionalProperties": {
            "type": "array",
            "items": { "type": "string" }
          }
        },
        "order": {
          "type": "object",
          "description": "Global z-order within a region (lower comes first)",
          "additionalProperties": { "type": "integer" }
        },
        "overrides": {
          "type": "object",
          "description": "Per-control overrides (region/order/visibility/position)",
          "additionalProperties": {
            "type": "object",
            "properties": {
              "region": { "type": "string" },
              "order": { "type": "integer" },
              "visible": { "type": "boolean" },
              "position": {
                "type": "object",
                "properties": {
                  "mode": { "type": "string", "enum": ["region", "absolute"] },
                  "top": { "type": "number" },
                  "right": { "type": "number" },
                  "bottom": { "type": "number" },
                  "left": { "type": "number" }
                },
                "additionalProperties": false
              }
            },
            "additionalProperties": true
          }
        },
        "breakpoints": {
          "type": "object",
          "description": "Responsive overrides per breakpoint",
          "properties": {
            "desktop": { "$ref": "#/definitions/bp" },
            "tablet": { "$ref": "#/definitions/bp" },
            "mobile": { "$ref": "#/definitions/bp" }
          },
          "additionalProperties": { "$ref": "#/definitions/bp" }
        },
        "style": {
          "type": "object",
          "properties": {
            "gap": { "type": "number" },
            "padding": { "type": "number" },
            "align": { "type": "string", "enum": ["start", "center", "end", "space-between"] }
          },
          "additionalProperties": true
        }
      },
      "additionalProperties": false,
      "definitions": {
        "bp": {
          "type": "object",
          "properties": {
            "regions": {
              "type": "object",
              "additionalProperties": {
                "type": "array",
                "items": { "type": "string" }
              }
            },
            "overrides": {
              "type": "object",
              "additionalProperties": {
                "type": "object",
                "properties": {
                  "region": { "type": "string" },
                  "order": { "type": "integer" },
                  "visible": { "type": "boolean" },
                  "position": {
                    "type": "object",
                    "properties": {
                      "mode": { "type": "string", "enum": ["region", "absolute"] },
                      "top": { "type": "number" },
                      "right": { "type": "number" },
                      "bottom": { "type": "number" },
                      "left": { "type": "number" }
                    },
                    "additionalProperties": false
                  }
                },
                "additionalProperties": true
              }
            }
          },
          "additionalProperties": false
        }
      }
    },
    "meta": {
      "type": "object",
      "properties": {
        "updatedAt": { "type": "string", "format": "date-time" },
        "updatedBy": { "type": "string" }
      },
      "additionalProperties": true
    }
  },
  "additionalProperties": false
}
```


## Database model

One record per `playerId`. Store `visibility` and `layout` as JSON/JSONB so you can evolve easily.

```sql
CREATE TABLE IF NOT EXISTS player_ui_config (
  player_id TEXT PRIMARY KEY,
  v INTEGER NOT NULL DEFAULT 1,
  visibility JSONB NOT NULL DEFAULT '{}'::jsonb,
  layout JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT
);
```


## Backend outline (Express-style pseudocode)

```js
// GET /player-ui/:playerId
app.get('/player-ui/:playerId', async (req, res) => {
  const playerId = req.params.playerId.trim();
  const row = await db.selectOne('player_ui_config', { player_id: playerId });
  if (!row) return res.status(404).json({ error: 'not_found', playerId });

  const defaultsVis = {
    cast: true, settings: true, share: true, fullscreen: true, pip: true,
    playlist: true, skipBack: true, skipForward: true, volume: true,
    time: true, qualityBadge: true, seekbar: true
  };
  const vis = { ...defaultsVis, ...(row.visibility || {}) };
  const layout = row.layout || {};

  res.json({
    playerId,
    v: row.v || 1,
    visibility: vis,
    layout,
    meta: { updatedAt: row.updated_at, updatedBy: row.updated_by || null }
  });
});

// PUT /player-ui/:playerId
app.put('/player-ui/:playerId', requireAdminAuth, async (req, res) => {
  const playerId = req.params.playerId.trim();
  const incomingVis = req.body?.visibility || {};
  const incomingLayout = req.body?.layout || {};

  const allowedVis = [
    'cast','settings','share','fullscreen','pip','playlist',
    'skipBack','skipForward','volume','time','qualityBadge','seekbar'
  ];
  const cleanedVis = {};
  for (const k of allowedVis) if (typeof incomingVis[k] === 'boolean') cleanedVis[k] = incomingVis[k];

  await db.upsert('player_ui_config', {
    player_id: playerId,
    v: 1,
    visibility: cleanedVis,
    layout: incomingLayout,
    updated_at: new Date(),
    updated_by: req.user?.email || 'system'
  });

  res.json({ status: true, playerId, v: 1, visibility: cleanedVis, layout: incomingLayout, meta: { updatedAt: new Date().toISOString(), updatedBy: req.user?.email || 'system' } });
});
```


## Admin panel UX (suggestion)

- Page: Player UI Profiles
  - Table: playerId, Updated, Updated By, Actions (Edit, Duplicate)
  - Tabs in edit form: Visibility, Layout, Preview
  - Visibility tab: toggles for all flags
  - Layout tab:
    - Template select (default/classic/compact/mobile-first)
    - Region editor (drag buttons into regions, set order)
    - Breakpoint editor (desktop/tablet/mobile overrides)
    - Per-control overrides (region/order/visibility, optional absolute position)
  - Preview tab: embedded test player using this `playerId`


## Player integration (WebPlayer)

Pass a `playerId` and a `visibilityEndpoint`. The player calls GET /player-ui/{playerId}, applies `visibility`, then applies `layout` by moving controls into regions and ordering them. If fetch fails or 404, it uses all-visible + default layout.

```ts
await player.initialize('#player', {
  ui: {
    playerId: 'landing_hero',
    visibilityEndpoint: 'https://your-api.example.com/player-ui/{playerId}'
  }
} as any);
```

Region model in the player (suggestion)
- Predefine region containers in DOM (created by the player) such as:
  - topLeft, topRight, bottomLeft, bottomRight, bottomFull, centerOverlay
- For each region name in `layout.regions`, the player appends known control nodes by ID.
- Apply `order` and per-control `overrides` to fine-tune placement.
- `breakpoints` are applied by listening to resize and reapplying the region mapping.


## Defaults (no config)

If no record exists for a `playerId` or the request fails, the player should:
- Show all controls (visibility = all true)
- Use the internal default layout (template = default)


## Future-proofing

- Keep `v` for schema evolution (e.g., adding new regions or properties)
- Unknown fields should be ignored by the player

