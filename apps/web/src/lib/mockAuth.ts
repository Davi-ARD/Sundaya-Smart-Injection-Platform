import {
  Role,
  type AuthResponse,
  type CreateOperatorRequest,
  type CreateUserRequest,
  type LoginRequest,
  type RegisterRequest,
  type UpdateUserRequest,
  type User,
} from '@mold-tracker/shared'

const USERS_KEY = 'mold-tracker:mock-users'
const TOKEN_PREFIX = 'mock-token:'

type MockUserRecord = User & {
  password: string
}

const now = () => new Date().toISOString()

const seedUsers: MockUserRecord[] = [
  {
    id: 'usr-admin-001',
    nama: 'Admin Mold Tracker',
    email: 'admin@mold.local',
    password: 'password123',
    role: Role.ADMIN,
    parentId: null,
    isActive: true,
    createdAt: now(),
  },
  {
    id: 'usr-penyedia-001',
    nama: 'Penyedia Surya Molding',
    email: 'penyedia@mold.local',
    password: 'password123',
    role: Role.PENYEDIA,
    parentId: null,
    isActive: true,
    createdAt: now(),
  },
  {
    id: 'usr-penyewa-001',
    nama: 'Penyewa Nusantara Plastik',
    email: 'penyewa@mold.local',
    password: 'password123',
    role: Role.PENYEWA,
    parentId: null,
    isActive: true,
    createdAt: now(),
  },
  {
    id: 'usr-operator-001',
    nama: 'Operator Lini A',
    email: 'operator@mold.local',
    password: 'password123',
    role: Role.OPERATOR,
    parentId: 'usr-penyewa-001',
    isActive: true,
    createdAt: now(),
  },
]

const toUser = (record: MockUserRecord): User => ({
  id: record.id,
  nama: record.nama,
  email: record.email,
  role: record.role,
  parentId: record.parentId,
  isActive: record.isActive,
  createdAt: record.createdAt,
})

const readUsers = (): MockUserRecord[] => {
  const rawUsers = localStorage.getItem(USERS_KEY)

  if (!rawUsers) {
    localStorage.setItem(USERS_KEY, JSON.stringify(seedUsers))
    return seedUsers
  }

  return JSON.parse(rawUsers) as MockUserRecord[]
}

const writeUsers = (users: MockUserRecord[]) => {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

const createId = () => `usr-${crypto.randomUUID()}`

const createToken = (userId: string) => `${TOKEN_PREFIX}${userId}`

const getUserIdFromToken = (token: string) => {
  if (!token.startsWith(TOKEN_PREFIX)) {
    throw new Error('Token tidak valid.')
  }

  return token.replace(TOKEN_PREFIX, '')
}

const assertUniqueEmail = (email: string, currentUserId?: string) => {
  const isUsed = readUsers().some(
    (user) => user.email === email && user.id !== currentUserId,
  )

  if (isUsed) {
    throw new Error('Email sudah digunakan.')
  }
}

const assertRole = (currentUser: User, allowedRoles: Role[]) => {
  if (!allowedRoles.includes(currentUser.role)) {
    throw new Error('Role tidak berwenang mengakses fitur ini.')
  }
}

export const mockAuthApi = {
  register(request: RegisterRequest): AuthResponse {
    if (![Role.PENYEWA, Role.PENYEDIA].includes(request.role)) {
      throw new Error('Registrasi mandiri hanya untuk Penyewa atau Penyedia.')
    }

    assertUniqueEmail(request.email)

    const users = readUsers()
    const record: MockUserRecord = {
      id: createId(),
      nama: request.nama,
      email: request.email,
      password: request.password,
      role: request.role,
      parentId: null,
      isActive: true,
      createdAt: now(),
    }

    writeUsers([record, ...users])

    return {
      accessToken: createToken(record.id),
      user: toUser(record),
    }
  },

  login(request: LoginRequest): AuthResponse {
    const record = readUsers().find((user) => user.email === request.email)

    if (!record || record.password !== request.password) {
      throw new Error('Email atau kata sandi tidak sesuai.')
    }

    if (!record.isActive) {
      throw new Error('Akun sudah dinonaktifkan.')
    }

    return {
      accessToken: createToken(record.id),
      user: toUser(record),
    }
  },

  me(accessToken: string): User {
    const userId = getUserIdFromToken(accessToken)
    const record = readUsers().find((user) => user.id === userId)

    if (!record || !record.isActive) {
      throw new Error('Sesi tidak ditemukan.')
    }

    return toUser(record)
  },

  listUsers(currentUser: User, filters: Pick<UpdateUserRequest, 'isActive'> & { role?: Role } = {}): User[] {
    assertRole(currentUser, [Role.ADMIN])

    return readUsers()
      .filter((user) => (filters.role ? user.role === filters.role : true))
      .filter((user) =>
        typeof filters.isActive === 'boolean'
          ? user.isActive === filters.isActive
          : true,
      )
      .map(toUser)
  },

  createUser(currentUser: User, request: CreateUserRequest): User {
    assertRole(currentUser, [Role.ADMIN])
    assertUniqueEmail(request.email)

    const users = readUsers()
    const record: MockUserRecord = {
      id: createId(),
      nama: request.nama,
      email: request.email,
      password: request.password,
      role: request.role,
      parentId: request.parentId ?? null,
      isActive: true,
      createdAt: now(),
    }

    writeUsers([record, ...users])
    return toUser(record)
  },

  updateUser(currentUser: User, userId: string, request: UpdateUserRequest): User {
    assertRole(currentUser, [Role.ADMIN])

    if (request.email) {
      assertUniqueEmail(request.email, userId)
    }

    const users = readUsers()
    const record = users.find((user) => user.id === userId)

    if (!record) {
      throw new Error('Pengguna tidak ditemukan.')
    }

    const nextRecord: MockUserRecord = {
      ...record,
      nama: request.nama ?? record.nama,
      email: request.email ?? record.email,
      role: request.role ?? record.role,
      isActive: request.isActive ?? record.isActive,
    }

    writeUsers(users.map((user) => (user.id === userId ? nextRecord : user)))
    return toUser(nextRecord)
  },

  deactivateUser(currentUser: User, userId: string): User {
    return this.updateUser(currentUser, userId, { isActive: false })
  },

  listOperators(currentUser: User): User[] {
    assertRole(currentUser, [Role.PENYEWA])

    return readUsers()
      .filter(
        (user) => user.role === Role.OPERATOR && user.parentId === currentUser.id,
      )
      .map(toUser)
  },

  createOperator(currentUser: User, request: CreateOperatorRequest): User {
    assertRole(currentUser, [Role.PENYEWA])
    assertUniqueEmail(request.email)

    const users = readUsers()
    const record: MockUserRecord = {
      id: createId(),
      nama: request.nama,
      email: request.email,
      password: request.password,
      role: Role.OPERATOR,
      parentId: currentUser.id,
      isActive: true,
      createdAt: now(),
    }

    writeUsers([record, ...users])
    return toUser(record)
  },
}
