# 💬 ChatSphere — Real-Time Multi Tenant Chat Application

A full-stack, production-ready real-time chat application built with **React**, **FastAPI**, and **PostgreSQL**.

---

## ✅ Features

| # | Feature | Status |
|---|---------|--------|
| 1 | **Multi-tenancy** | ✅ Full tenant isolation with slug-based routing |
| 2 | **Multiple chat windows** | ✅ Unlimited persistent chats per tenant |
| 3 | **Group chats** | ✅ Groups with owner/admin/member roles |
| 4 | **Sharing** | ✅ Forward messages + shareable links |
| 5 | **Real-time indicators** | ✅ Typing indicators + online/offline presence |
| 6 | **Multiple chat windows** | ✅ DMs, Groups, Topic channels |
| 7 | **Topic-based chats** | ✅ Filterable topic channels (like Slack) |
| 8 | **Rate limiting** | ✅ Per-IP rate limiting via slowapi |
| 9 | **Subscription plans** | ✅ Free / Pro / Enterprise with Stripe scaffold |
| 10 | **Authentication** | ✅ JWT access+refresh tokens, bcrypt, per-tenant |

---

## 🏗 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, TypeScript, Tailwind CSS, Zustand, Vite |
| **Backend** | Python 3.12, FastAPI, SQLAlchemy 2.0 (async) |
| **Database** | PostgreSQL 16 |
| **Realtime** | WebSockets (native FastAPI) |
| **Cache** | Redis (session/rate limit support) |
| **Auth** | JWT (access + refresh tokens), bcrypt |
| **Payments** | Stripe (scaffold ready) |
| **Deploy** | Docker + Docker Compose + Nginx |

---

## 📁 Project Structure

```
chat-app/
├── backend/
│   ├── app/
│   │   ├── api/              # Route handlers
│   │   │   ├── auth.py       # Register, Login, Refresh
│   │   │   ├── chats.py      # Chat CRUD + members
│   │   │   ├── messages.py   # Messages + reactions + sharing
│   │   │   ├── users.py      # User profiles + subscriptions
│   │   │   └── websocket.py  # WS endpoint + event routing
│   │   ├── core/
│   │   │   ├── config.py     # Settings from .env
│   │   │   ├── deps.py       # Auth dependencies
│   │   │   └── security.py   # JWT + password hashing
│   │   ├── db/
│   │   │   └── database.py   # Async SQLAlchemy engine
│   │   ├── models/
│   │   │   └── models.py     # All DB models (12 tables)
│   │   ├── schemas/
│   │   │   └── schemas.py    # Pydantic request/response schemas
│   │   ├── services/
│   │   │   └── websocket_manager.py  # WS connection manager
│   │   └── main.py           # FastAPI app + middleware
│   ├── alembic/              # Database migrations
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── auth/         # ProtectedRoute
│   │   │   ├── chat/         # ChatWindow, MessageBubble, MessageInput, etc.
│   │   │   ├── layout/       # Sidebar, SettingsModal
│   │   │   └── shared/       # UserAvatar
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts   # Global WS event handlers
│   │   │   └── useTyping.ts      # Typing indicator hook
│   │   ├── pages/
│   │   │   ├── AuthPages.tsx     # Login + Register
│   │   │   └── ChatLayout.tsx    # Main chat page
│   │   ├── services/
│   │   │   ├── api.ts            # Axios API service
│   │   │   └── websocket.ts      # WS service with auto-reconnect
│   │   ├── store/
│   │   │   ├── authStore.ts      # Auth state (persisted)
│   │   │   └── chatStore.ts      # Chats + messages state
│   │   └── types/index.ts        # TypeScript types
│   ├── nginx.conf
│   └── Dockerfile
│
└── docker-compose.yml
```

---

## 🔌 API Reference

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register-tenant` | Create organization |
| POST | `/api/v1/auth/register` | Register user |
| POST | `/api/v1/auth/login` | Login |
| POST | `/api/v1/auth/refresh` | Refresh access token |
| POST | `/api/v1/auth/logout` | Logout |

### Chats
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/chats` | List my chats |
| POST | `/api/v1/chats` | Create chat (DM/Group/Topic) |
| GET | `/api/v1/chats/{id}/members` | Get members |
| POST | `/api/v1/chats/{id}/members/{uid}` | Add member |
| DELETE | `/api/v1/chats/{id}/members/{uid}` | Remove member |
| PATCH | `/api/v1/chats/{id}/read` | Mark as read |

### Messages
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/chats/{id}/messages` | List messages (paginated) |
| POST | `/api/v1/chats/{id}/messages` | Send message |
| POST | `/api/v1/chats/{id}/messages/upload` | Upload file |
| PATCH | `/api/v1/chats/{id}/messages/{mid}` | Edit message |
| DELETE | `/api/v1/chats/{id}/messages/{mid}` | Delete message |
| POST | `/api/v1/chats/{id}/messages/{mid}/react` | React with emoji |
| POST | `/api/v1/chats/{id}/messages/{mid}/share` | Share message |

### WebSocket
Connect: `ws://localhost:8000/ws?token=<access_token>`

**Client → Server events:**
```json
{ "type": "typing", "payload": { "chat_id": "...", "is_typing": true } }
{ "type": "join_chat", "payload": { "chat_id": "..." } }
{ "type": "ping", "payload": {} }
```

**Server → Client events:**
```json
{ "type": "new_message", "payload": { ...message } }
{ "type": "message_edited", "payload": { "message_id": "...", "content": "..." } }
{ "type": "message_deleted", "payload": { "message_id": "..." } }
{ "type": "typing_indicator", "payload": { "chat_id": "...", "user_id": "...", "is_typing": true } }
{ "type": "user_online", "payload": { "user_id": "..." } }
{ "type": "user_offline", "payload": { "user_id": "..." } }
{ "type": "reaction_updated", "payload": { "message_id": "...", "emoji": "👍", "action": "added" } }
```

---

## 🗄 Database Schema

```
Tenant ─── User ─── ChatMember ─── Chat ─── Message ─── MessageReaction
                 └── RefreshToken            └── MessageShare
                 └── UserSubscription
       └── TenantSubscription
```

---

---

## 📜 License
MIT
