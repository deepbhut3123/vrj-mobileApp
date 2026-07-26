import axios, { AxiosError } from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE_URL_FROM_ENV = process.env.EXPO_PUBLIC_API_URL;

if (!API_BASE_URL_FROM_ENV) {
  throw new Error("Missing EXPO_PUBLIC_API_URL in .env");
}

const normalizeApiUrl = (url: string) => url.trim().replace(/\/+$/, "");

export const API_BASE_URL = normalizeApiUrl(API_BASE_URL_FROM_ENV);
const AUTH_STORAGE_KEY = "auth_session_v1";

const decodeBase64Url = (value: string) => {
  if (typeof globalThis.atob !== "function") {
    return null;
  }

  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4;
  const padded = padding ? normalized.padEnd(normalized.length + (4 - padding), "=") : normalized;

  try {
    return globalThis.atob(padded);
  } catch {
    return null;
  }
};

const getTokenExpiryTimestamp = (token: string) => {
  try {
    const [, payload] = token.split(".");
    if (!payload) {
      return null;
    }

    const decodedPayload = decodeBase64Url(payload);
    if (!decodedPayload) {
      return null;
    }

    const parsed = JSON.parse(decodedPayload) as { exp?: unknown };
    const expSeconds = Number(parsed.exp);
    if (!Number.isFinite(expSeconds) || expSeconds <= 0) {
      return null;
    }

    return expSeconds * 1000;
  } catch {
    return null;
  }
};

let authToken = "";
let currentUser: AuthUser | null = null;
let authHydrated = false;

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  mobileNumber?: string;
  roleId: number;
  isActive?: boolean;
  salary?: number | null;
  salaryPerDay?: number | null;
  salaryPerHour?: number | null;
};

export type AppRoute = {
  _id: string;
  userId: string;
  routeName: string;
  routeNameGujarati?: string;
  cityName: string;
  cityNameGujarati?: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminUser = {
  _id: string;
  name: string;
  email: string;
  mobileNumber?: string;
  roleId: 1 | 2 | 3;
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AppDealer = {
  _id: string;
  dealerName: string;
  contactNo?: string;
  city?: string;
  margin?: number;
  pendingPayment?: number;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  userId?: {
    _id?: string;
    name?: string;
    email?: string;
    mobileNumber?: string;
    roleId?: number;
  };
};

export type AppShop = {
  _id: string;
  shopName: string;
  shopNameGujarati?: string;
  shopAddress: string;
  mobileNumber?: string;
  latitude?: number;
  longitude?: number;
  image?: string;
  shopImage?: string;
  routeId?: string | AppRoute;
  route?: AppRoute;
  userId?: string | AuthUser;
  createdBy?: string | AuthUser;
  createdAt: string;
  updatedAt: string;
};

export type AppProduct = {
  _id: string;
  sequence?: number;
  productName: string;
  mrp: number;
  productRate: number;
  createdAt: string;
  updatedAt: string;
};

export type DealerProduct = {
  _id: string;
  sequence?: number;
  productName: string;
  mrp: number;
  productRate: number;
  createdAt?: string;
  updatedAt?: string;
};

export type AppBillItem = {
  productId: string | AppProduct;
  productName: string;
  mrp?: number;
  productRate: number;
  quantity: number;
  total: number;
};

export type AppBill = {
  _id: string;
  userId?: string | AuthUser;
  deliveryManId?: string | AuthUser | null;
  routeId: string | AppRoute;
  shopId: string | AppShop;
  items: AppBillItem[];
  totalAmount: number;
  status: "ordered" | "processing" | "completed" | "shipped" | "delivered" | "cancelled";
  createdAt: string;
  updatedAt: string;
};

export type DealerBillItem = {
  productId?: string | AppProduct | DealerProduct | null;
  mrp?: number;
  productName?: string;
  productRate?: number;
  amount?: number;
  quantity?: number;
  total?: number;
};

export type DealerBill = {
  _id: string;
  billDate: string;
  kattaCount: number;
  totalAmount: number;
  status?: "ordered" | "shipped" | "completed" | "cancelled";
  stockDeductedAt?: string | null;
  paidAmount?: number;
  pendingAmount?: number;
  pendingPayment?: number;
  balanceAmount?: number;
  dueAmount?: number;
  remainingAmount?: number;
  outstandingAmount?: number;
  unpaidAmount?: number;
  items?: DealerBillItem[];
  dealerId?: {
    _id?: string;
    dealerName?: string;
    contactNo?: string;
    city?: string;
    margin?: number;
  };
  userId?: {
    id?: string;
    _id?: string;
    name?: string;
    email?: string;
    roleId?: number;
  };
  createdAt?: string;
  updatedAt?: string;
};

export type DealerPayment = {
  _id: string;
  paymentDate: string;
  amount: number;
  paymentType: "cash" | "online" | "bank";
  dealerId?: {
    _id?: string;
    dealerName?: string;
    contactNo?: string;
    city?: string;
  };
  userId?: {
    _id?: string;
    name?: string;
    email?: string;
    roleId?: number;
  };
  createdAt?: string;
  updatedAt?: string;
};

export type AttendanceAction = "in" | "out" | "break-in" | "break-out";

export type AttendanceEntry = {
  _id: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  breakIn?: string | null;
  breakOut?: string | null;
  status: string;
  note: string;
  createdAt?: string;
  updatedAt?: string;
};

export type UploadImageFile = {
  uri: string;
  name?: string;
  mimeType?: string;
  size?: number;
};

export const setAuthToken = (token: string) => {
  authToken = token;
};

export const clearAuthToken = () => {
  authToken = "";
  currentUser = null;
  void AsyncStorage.removeItem(AUTH_STORAGE_KEY);
};

export const setCurrentUser = (user: AuthUser | null) => {
  currentUser = user;
};

export const getCurrentUser = () => currentUser;
export const isAuthHydrated = () => authHydrated;

export const getRoleLabel = (roleId?: number | null) => {
  switch (Number(roleId)) {
    case 1:
      return "Admin";
    case 2:
      return "Retailer";
    case 3:
      return "Dealer";
    case 4:
      return "Salesman";
    case 5:
      return "Staff";
    case 6:
      return "Delivery Man";
    default:
      return "User";
  }
};

const parseFlexibleNumber = (value: unknown) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.-]/g, "");
    if (!cleaned) {
      return null;
    }

    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const persistAuthSession = async (payload: {
  token: string;
  user: AuthUser;
  expiresAt: number | null;
}) => {
  await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload));
};

export const hydrateAuthSession = async () => {
  try {
    const raw = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      authHydrated = true;
      return;
    }

    const parsed = JSON.parse(raw) as {
      token?: unknown;
      user?: unknown;
      expiresAt?: unknown;
    };

    const expiresAt = Number(parsed.expiresAt);
    if (Number.isFinite(expiresAt) && expiresAt > 0 && Date.now() > expiresAt) {
      clearAuthToken();
      authHydrated = true;
      return;
    }

    const token = typeof parsed.token === "string" ? parsed.token : "";
    const user = parsed.user as AuthUser | undefined;
    if (
      !token ||
      !user ||
      typeof user !== "object" ||
      !("id" in user) ||
      !("name" in user) ||
      !("roleId" in user) ||
      Number.isNaN(Number(user.roleId))
    ) {
      clearAuthToken();
      authHydrated = true;
      return;
    }

    authToken = token;
    currentUser = {
      id: String(user.id),
      name: String(user.name),
      email: String(user.email ?? ""),
      mobileNumber: user.mobileNumber ? String(user.mobileNumber) : "",
      roleId: Number(user.roleId),
      salary:
        typeof user.salary === "number" && Number.isFinite(user.salary) ? user.salary : null,
      salaryPerDay:
        typeof user.salaryPerDay === "number" && Number.isFinite(user.salaryPerDay)
          ? user.salaryPerDay
          : null,
      salaryPerHour:
        typeof user.salaryPerHour === "number" && Number.isFinite(user.salaryPerHour)
          ? user.salaryPerHour
          : null,
    };
  } catch {
    clearAuthToken();
  } finally {
    authHydrated = true;
  }
};

export const API = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
});

API.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

API.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string }>) => {
    const status = error.response?.status;
    const message = error.response?.data?.message || "";

    if (status === 401) {
      clearAuthToken();
    }
    if (status === 403 && message.toLowerCase().includes("deactivated")) {
      clearAuthToken();
    }

    return Promise.reject(error);
  },
);

export type ApiResult<T = unknown> = {
  ok: boolean;
  status: number | null;
  data: T | null;
  message: string;
};

export type LoginResponse = {
  token?: string;
  user?: unknown;
  requiresVerification?: boolean;
  verificationToken?: string;
  verificationMethod?: "authenticator";
  requiresAuthenticatorSetup?: boolean;
  authenticatorSecret?: string;
  otpauthUrl?: string;
  adminEmail?: string;
  message?: string;
};


const executeShopMultipartRequest = async (
  method: "POST" | "PUT",
  path: string,
  formData: FormData,
): Promise<ApiResult> => {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
      body: formData,
    });

    const raw = await response.text();
    const json = raw ? (JSON.parse(raw) as unknown) : null;

    if (!response.ok) {
      const message = getApiErrorMessage(json) || `Request failed with status ${response.status}`;
      return {
        ok: false,
        status: response.status,
        data: json,
        message,
      };
    }

    return {
      ok: true,
      status: response.status,
      data: json,
      message: getApiErrorMessage(json) || "Request successful",
    };
  } catch (error) {
    return asShopApiError(error, "Unable to upload shop image.");
  }
};

const getApiErrorMessage = (data: unknown) => {
  if (!data || typeof data !== "object") {
    return "";
  }
  if ("message" in data && typeof (data as { message?: unknown }).message === "string") {
    return String((data as { message: string }).message || "");
  }
  if ("error" in data && typeof (data as { error?: unknown }).error === "string") {
    return String((data as { error: string }).error || "");
  }
  return "";
};

const asApiResult = <T>(status: number, data: T): ApiResult<T> => {
  const message =
    typeof data === "object" &&
    data !== null &&
    "message" in data &&
    typeof (data as { message?: string }).message === "string"
      ? (data as { message: string }).message || "Request successful"
      : "Request successful";

  return {
    ok: true,
    status,
    data,
    message,
  };
};

const asApiError = (error: unknown, fallback: string): ApiResult => {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status ?? null;
    const data = (error.response?.data as unknown) ?? null;
    const isTimeout = error.code === "ECONNABORTED";
    const isNetworkError = !error.response;
    const messageFromApi = getApiErrorMessage(data);
    const message =
      isTimeout
        ? "Request timed out while contacting backend. Please try again."
      : isNetworkError
        ? `Network error. Cannot reach backend at ${API_BASE_URL}.`
        : messageFromApi
        ? messageFromApi || fallback
        : error.message || fallback;

    return {
      ok: false,
      status,
      data,
      message,
    };
  }

  return {
    ok: false,
    status: null,
    data: null,
    message: fallback,
  };
};

const asShopApiError = (error: unknown, fallback: string): ApiResult => {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status ?? null;
    const data = (error.response?.data as unknown) ?? null;
    const isTimeout = error.code === "ECONNABORTED";
    const isNetworkError = !error.response || error.code === "ERR_NETWORK";
    const messageFromApi = getApiErrorMessage(data);

    if (messageFromApi) {
      return {
        ok: false,
        status,
        data,
        message: messageFromApi,
      };
    }

    if (isTimeout) {
      return {
        ok: false,
        status,
        data,
        message: "Shop request timed out. Please try again.",
      };
    }

    if (isNetworkError) {
      return {
        ok: false,
        status,
        data,
        message: `Unable to reach shop service at ${API_BASE_URL}. Check backend status and network.`,
      };
    }

    if (status === 400) {
      return {
        ok: false,
        status,
        data,
        message: "Invalid shop request. Please check the form fields.",
      };
    }

    if (status === 401) {
      return {
        ok: false,
        status,
        data,
        message: "Session expired. Please sign in again.",
      };
    }

    if (status === 403) {
      return {
        ok: false,
        status,
        data,
        message: "You are not allowed to perform this shop action.",
      };
    }

    if (status === 404) {
      return {
        ok: false,
        status,
        data,
        message: "Requested shop/route data was not found.",
      };
    }

    if (status === 413) {
      return {
        ok: false,
        status,
        data,
        message: "Image file is too large. Please upload an image under 10MB.",
      };
    }

    if (status && status >= 500) {
      return {
        ok: false,
        status,
        data,
        message: "Shop service is temporarily unavailable. Please try again in a moment.",
      };
    }
  }

  return asApiError(error, fallback);
};

const postWithFallback = async <T>(
  paths: string[],
  payload: unknown,
  fallbackMessage: string,
): Promise<ApiResult<T>> => {
  let lastError: unknown = null;

  for (const path of paths) {
    try {
      const response = await API.post<T>(path, payload);
      return asApiResult<T>(response.status, response.data);
    } catch (error) {
      lastError = error;

      if (axios.isAxiosError(error)) {
        const status = error.response?.status ?? null;
        const shouldTryNextPath = status === 404;

        if (!shouldTryNextPath) {
          return asApiError(error, fallbackMessage) as ApiResult<T>;
        }
      } else {
        return asApiError(error, fallbackMessage) as ApiResult<T>;
      }
    }
  }

  return asApiError(lastError, fallbackMessage) as ApiResult<T>;
};

const getWithFallback = async <T>(
  paths: string[],
  fallbackMessage: string,
): Promise<ApiResult<T>> => {
  let lastError: unknown = null;

  for (const path of paths) {
    try {
      const response = await API.get<T>(path);
      return asApiResult<T>(response.status, response.data);
    } catch (error) {
      lastError = error;

      if (axios.isAxiosError(error)) {
        const status = error.response?.status ?? null;
        const shouldTryNextPath = status === 404;

        if (!shouldTryNextPath) {
          return asApiError(error, fallbackMessage) as ApiResult<T>;
        }
      } else {
        return asApiError(error, fallbackMessage) as ApiResult<T>;
      }
    }
  }

  return asApiError(lastError, fallbackMessage) as ApiResult<T>;
};

const normalizeAttendanceValue = (value: unknown) => {
  if (typeof value === "string") {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return null;
};

const normalizeAttendanceEntry = (entry: unknown, index: number): AttendanceEntry | null => {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const record = entry as Record<string, unknown>;
  const idRaw = record._id ?? record.id ?? `attendance-${index}`;
  const dateRaw =
    record.date ??
    record.day ??
    record.attendanceDate ??
    record.createdAt ??
    record.updatedAt ??
    new Date().toISOString();
  const checkInRaw =
    record.checkIn ??
    record.checkInTime ??
    record.inTime ??
    record.in ??
    null;
  const checkOutRaw =
    record.checkOut ??
    record.checkOutTime ??
    record.outTime ??
    record.out ??
    null;
  const breakInRaw =
    record.breakIn ??
    record.breakInTime ??
    record.breakStart ??
    record.breakStartTime ??
    record.break_in ??
    null;
  const breakOutRaw =
    record.breakOut ??
    record.breakOutTime ??
    record.breakEnd ??
    record.breakEndTime ??
    record.break_out ??
    null;
  const statusRaw = record.status ?? record.attendanceStatus ?? record.state ?? "Present";
  const noteRaw = record.note ?? record.notes ?? record.remark ?? record.message ?? "";

  return {
    _id: String(idRaw),
    date: String(dateRaw),
    checkIn: normalizeAttendanceValue(checkInRaw),
    checkOut: normalizeAttendanceValue(checkOutRaw),
    breakIn: normalizeAttendanceValue(breakInRaw),
    breakOut: normalizeAttendanceValue(breakOutRaw),
    status: String(statusRaw || "Present"),
    note: String(noteRaw || ""),
    createdAt: normalizeAttendanceValue(record.createdAt) ?? undefined,
    updatedAt: normalizeAttendanceValue(record.updatedAt) ?? undefined,
  };
};

const extractAttendanceEntries = (payload: unknown): AttendanceEntry[] => {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const source = payload as Record<string, unknown>;
  const listCandidate =
    source.data ??
    source.attendance ??
    source.records ??
    source.items ??
    source.history;

  if (!Array.isArray(listCandidate)) {
    return [];
  }

  return listCandidate
    .map((entry, index) => normalizeAttendanceEntry(entry, index))
    .filter((entry): entry is AttendanceEntry => Boolean(entry));
};

export const pingBackend = async (): Promise<ApiResult> => {
  try {
    const response = await API.get("/api/health");
    return asApiResult(response.status, response.data);
  } catch (error) {
    return asApiError(error, "Unable to reach backend");
  }
};

export const registerUser = async (data: {
  name: string;
  email: string;
  password: string;
  roleId: 2;
}) => {
  try {
    const response = await API.post("/api/auth/register", {
      ...data,
      roleid: data.roleId,
    });
    return asApiResult(response.status, response.data);
  } catch (error) {
    return asApiError(error, "Unable to register. Please try again.");
  }
};

const extractAllowedUser = (payload: unknown): AuthUser | null => {
  const userData =
    typeof payload === "object" &&
    payload !== null &&
    "user" in payload
      ? (payload as { user?: unknown }).user
      : null;

  if (!userData || typeof userData !== "object") {
    return null;
  }

  const roleRaw =
    "roleId" in userData
      ? (userData as { roleId?: unknown }).roleId
      : "roleid" in userData
      ? (userData as { roleid?: unknown }).roleid
      : undefined;

  const idRaw =
    "id" in userData
      ? (userData as { id?: unknown }).id
      : "_id" in userData
      ? (userData as { _id?: unknown })._id
      : undefined;

  const nameRaw =
    "name" in userData
      ? (userData as { name?: unknown }).name
      : "fullName" in userData
      ? (userData as { fullName?: unknown }).fullName
      : "dealerName" in userData
      ? (userData as { dealerName?: unknown }).dealerName
      : "displayName" in userData
      ? (userData as { displayName?: unknown }).displayName
      : undefined;
  const emailRaw = "email" in userData ? (userData as { email?: unknown }).email : undefined;
  const mobileNumberRaw =
    "mobileNumber" in userData ? (userData as { mobileNumber?: unknown }).mobileNumber : undefined;
  const roleId = Number(roleRaw);

  if (Number.isNaN(roleId)) {
    return null;
  }

  const isActiveRaw =
    "isActive" in userData ? (userData as { isActive?: unknown }).isActive : true;
  const salaryRaw =
    "salary" in userData
      ? (userData as { salary?: unknown }).salary
      : "monthlySalary" in userData
      ? (userData as { monthlySalary?: unknown }).monthlySalary
      : "salaryAmount" in userData
      ? (userData as { salaryAmount?: unknown }).salaryAmount
      : "fixedSalary" in userData
      ? (userData as { fixedSalary?: unknown }).fixedSalary
      : undefined;
  const salaryPerDayRaw =
    "salaryPerDay" in userData
      ? (userData as { salaryPerDay?: unknown }).salaryPerDay
      : "perDaySalary" in userData
      ? (userData as { perDaySalary?: unknown }).perDaySalary
      : "dailySalary" in userData
      ? (userData as { dailySalary?: unknown }).dailySalary
      : "daySalary" in userData
      ? (userData as { daySalary?: unknown }).daySalary
      : undefined;
  const salaryPerHourRaw =
    "salaryPerHour" in userData
      ? (userData as { salaryPerHour?: unknown }).salaryPerHour
      : "perHourSalary" in userData
      ? (userData as { perHourSalary?: unknown }).perHourSalary
      : "hourRate" in userData
      ? (userData as { hourRate?: unknown }).hourRate
      : "hourlyRate" in userData
      ? (userData as { hourlyRate?: unknown }).hourlyRate
      : "ratePerHour" in userData
      ? (userData as { ratePerHour?: unknown }).ratePerHour
      : undefined;
  const salary = parseFlexibleNumber(salaryRaw);
  const salaryPerDay = parseFlexibleNumber(salaryPerDayRaw);
  const salaryPerHour = parseFlexibleNumber(salaryPerHourRaw);

  return {
    id: String(idRaw ?? ""),
    name: String(nameRaw ?? "").trim(),
    email: String(emailRaw ?? ""),
    mobileNumber: String(mobileNumberRaw ?? ""),
    roleId,
    isActive: isActiveRaw !== false,
    salary,
    salaryPerDay,
    salaryPerHour,
  };
};

const finalizeAllowedSession = async (payload: LoginResponse) => {
  const token = typeof payload.token === "string" ? payload.token : "";
  if (!token) {
    return {
      ok: false,
      status: 500,
      data: payload,
      message: "Login response did not include a token.",
    } satisfies ApiResult<LoginResponse>;
  }

  const user = extractAllowedUser(payload);
  if (!user) {
    clearAuthToken();
    return {
      ok: false,
      status: 403,
      data: payload,
      message: "Login response did not include a valid user.",
    } satisfies ApiResult<LoginResponse>;
  }

  setAuthToken(token);
  setCurrentUser(user);
  const expiresAt = getTokenExpiryTimestamp(token);
  await persistAuthSession({
    token,
    user,
    expiresAt,
  });

  return {
    ok: true,
    status: 200,
    data: payload,
    message:
      typeof payload.message === "string" && payload.message
        ? payload.message
        : "Login successful",
  } satisfies ApiResult<LoginResponse>;
};

export const loginuser = async (data: { identifier: string; password: string }) => {
  try {
    const response = await API.post<LoginResponse>("/api/auth/login", {
      identifier: data.identifier,
      email: data.identifier,
      password: data.password,
    });
    setCurrentUser(null);
    clearAuthToken();

    if (response.data?.requiresVerification) {
      return asApiResult<LoginResponse>(response.status, response.data);
    }

    const finalized = await finalizeAllowedSession(response.data ?? {});
    if (!finalized.ok) {
      return finalized;
    }

    return asApiResult<LoginResponse>(response.status, response.data);
  } catch (error) {
    return asApiError(error, "Unable to login. Please try again.");
  }
};

export const verifyLoginCode = async (verificationToken: string, code: string) => {
  try {
    const response = await API.post<LoginResponse>("/api/auth/verify-login", {
      verificationToken,
      code,
    });

    setCurrentUser(null);
    clearAuthToken();

    const finalized = await finalizeAllowedSession(response.data ?? {});
    if (!finalized.ok) {
      return finalized;
    }

    return asApiResult<LoginResponse>(response.status, response.data);
  } catch (error) {
    return asApiError(error, "Unable to verify login code. Please try again.");
  }
};

export const forgotPassword = async (email: string) => {
  try {
    const response = await API.post("/api/auth/forgot-password", { email });
    return asApiResult(response.status, response.data);
  } catch (error) {
    return asApiError(error, "Unable to process forgot password request.");
  }
};

export const verifyResetOtp = async (email: string, otp: string) => {
  try {
    const response = await API.post("/api/auth/verify-reset-otp", {
      email,
      otp,
    });
    return asApiResult<{ resetToken?: string; message?: string }>(response.status, response.data);
  } catch (error) {
    return asApiError(error, "Unable to verify reset OTP.");
  }
};

export const resetPassword = async (token: string, newPassword: string) => {
  try {
    const response = await API.post("/api/auth/reset-password", {
      token,
      newPassword,
    });
    return asApiResult(response.status, response.data);
  } catch (error) {
    return asApiError(error, "Unable to reset password.");
  }
};

export const logoutCurrentUser = async () => {
  try {
    const response = await API.post("/api/auth/logout");
    clearAuthToken();
    return asApiResult(response.status, response.data);
  } catch (error) {
    clearAuthToken();
    return asApiError(error, "Unable to logout cleanly. Local session was cleared.");
  }
};

export const register = async (
  name: string,
  email: string,
  password: string,
) => registerUser({ name, email, password, roleId: 2 });

export const login = async (identifier: string, password: string) =>
  loginuser({ identifier, password });

export const createRoute = async (data: {
  routeName: string;
  routeNameGujarati?: string;
  cityName: string;
  cityNameGujarati?: string;
}) => {
  try {
    const response = await API.post("/api/admin/retailer/routes", {
      routeName: data.routeName,
      routeNameGujarati: data.routeNameGujarati ?? "",
      cityName: data.cityName,
      cityNameGujarati: data.cityNameGujarati ?? "",
    });
    return asApiResult<{ data: AppRoute }>(response.status, response.data);
  } catch (error) {
    return asApiError(error, "Unable to create route.");
  }
};

export const getMyRoutes = async () => {
  try {
    const response = await API.get("/api/admin/retailer/routes");
    return asApiResult<{ data: AppRoute[] }>(response.status, response.data);
  } catch (error) {
    return asApiError(error, "Unable to fetch routes.");
  }
};

export const getAllAdminRoutes = async () => {
  try {
    const response = await API.get("/api/admin/retailer/routes/all");
    return asApiResult<{ data: AppRoute[] }>(response.status, response.data);
  } catch (error) {
    return asApiError(error, "Unable to fetch admin routes.");
  }
};

export const getAllUsers = async () => {
  try {
    const response = await API.get("/api/admin/users");
    return asApiResult<{ data: AdminUser[] }>(response.status, response.data);
  } catch (error) {
    return asApiError(error, "Unable to fetch users.");
  }
};

export const getAllDealers = async () => {
  try {
    const response = await API.get("/api/admin/dealer/dealers");
    return asApiResult<{ data: AppDealer[] }>(response.status, response.data);
  } catch (error) {
    return asApiError(error, "Unable to fetch dealers.");
  }
};

export const createShop = async (data: {
  routeId: string;
  shopName: string;
  shopNameGujarati?: string;
  shopAddress: string;
  mobileNumber: string;
  latitude?: number;
  longitude?: number;
  imageFile?: UploadImageFile;
  imageUrl?: string;
}) => {
  try {
    if (data.imageFile?.uri) {
      const imageFile = data.imageFile;
      const formData = new FormData();
      formData.append("routeId", data.routeId);
      formData.append("shopName", data.shopName);
      formData.append("shopNameGujarati", data.shopNameGujarati ?? "");
      formData.append("shopAddress", data.shopAddress);
      formData.append("mobileNumber", data.mobileNumber);
      if (typeof data.latitude === "number") {
        formData.append("latitude", String(data.latitude));
      }
      if (typeof data.longitude === "number") {
        formData.append("longitude", String(data.longitude));
      }
      if (data.imageUrl) {
        formData.append("imageUrl", data.imageUrl);
      }

      const imageName =
        imageFile.name ||
        imageFile.uri.split("/").pop() ||
        `shop-image-${Date.now()}.jpg`;
      const mimeType =
        imageFile.mimeType ||
        (imageName.toLowerCase().endsWith(".png")
          ? "image/png"
          : imageName.toLowerCase().endsWith(".webp")
          ? "image/webp"
          : "image/jpeg");
      formData.append("image", {
        uri: imageFile.uri,
        name: imageName,
        type: mimeType,
      } as unknown as Blob);

      const result = await executeShopMultipartRequest("POST", "/api/admin/retailer/shops", formData);
      return result as ApiResult<{ data: AppShop }>;
    }

    const response = await API.post("/api/admin/retailer/shops", {
      routeId: data.routeId,
      shopName: data.shopName,
      shopNameGujarati: data.shopNameGujarati ?? "",
      shopAddress: data.shopAddress,
      mobileNumber: data.mobileNumber,
      latitude: data.latitude,
      longitude: data.longitude,
      imageUrl: data.imageUrl,
    });
    return asApiResult<{ data: AppShop }>(response.status, response.data);
  } catch (error) {
    return asShopApiError(error, "Unable to create shop.");
  }
};

export const getMyShops = async () => {
  try {
    const response = await API.get("/api/admin/retailer/shops/my-shops");
    return asApiResult<{ data: AppShop[] }>(response.status, response.data);
  } catch (error) {
    return asShopApiError(error, "Unable to fetch your shops.");
  }
};

export const getAllAdminShops = async () => {
  try {
    const response = await API.get("/api/admin/retailer/shops");
    return asApiResult<{ data: AppShop[] }>(response.status, response.data);
  } catch (error) {
    return asShopApiError(error, "Unable to fetch admin shops.");
  }
};

export const getShopRoutes = async () => {
  try {
    const response = await API.get("/api/admin/retailer/shops/routes");
    return asApiResult<{ data: AppRoute[] }>(response.status, response.data);
  } catch (error) {
    return asShopApiError(error, "Unable to fetch routes.");
  }
};

export const updateShopById = async (
  id: string,
  data: {
    routeId: string;
    shopName: string;
    shopNameGujarati?: string;
    shopAddress: string;
    mobileNumber: string;
    latitude?: number;
    longitude?: number;
    imageFile?: UploadImageFile;
    imageUrl?: string;
  }
) => {
  try {
    if (data.imageFile?.uri) {
      const imageFile = data.imageFile;
      const formData = new FormData();
      formData.append("routeId", data.routeId);
      formData.append("shopName", data.shopName);
      formData.append("shopNameGujarati", data.shopNameGujarati ?? "");
      formData.append("shopAddress", data.shopAddress);
      formData.append("mobileNumber", data.mobileNumber);
      if (typeof data.latitude === "number") {
        formData.append("latitude", String(data.latitude));
      }
      if (typeof data.longitude === "number") {
        formData.append("longitude", String(data.longitude));
      }
      if (data.imageUrl) {
        formData.append("imageUrl", data.imageUrl);
      }

      const imageName =
        imageFile.name ||
        imageFile.uri.split("/").pop() ||
        `shop-image-${Date.now()}.jpg`;
      const mimeType =
        imageFile.mimeType ||
        (imageName.toLowerCase().endsWith(".png")
          ? "image/png"
          : imageName.toLowerCase().endsWith(".webp")
          ? "image/webp"
          : "image/jpeg");
      formData.append("image", {
        uri: imageFile.uri,
        name: imageName,
        type: mimeType,
      } as unknown as Blob);

      const result = await executeShopMultipartRequest("PUT", `/api/admin/retailer/shops/${id}`, formData);
      return result as ApiResult<{ data: AppShop }>;
    }

    const response = await API.put(`/api/admin/retailer/shops/${id}`, {
      routeId: data.routeId,
      shopName: data.shopName,
      shopNameGujarati: data.shopNameGujarati ?? "",
      shopAddress: data.shopAddress,
      mobileNumber: data.mobileNumber,
      latitude: data.latitude,
      longitude: data.longitude,
      imageUrl: data.imageUrl,
    });
    return asApiResult<{ data: AppShop }>(response.status, response.data);
  } catch (error) {
    return asShopApiError(error, "Unable to update shop.");
  }
};

export const deleteShopById = async (id: string) => {
  try {
    const response = await API.delete(`/api/admin/retailer/shops/${id}`);
    return asApiResult(response.status, response.data);
  } catch (error) {
    return asShopApiError(error, "Unable to delete shop.");
  }
};

export const getBillProducts = async () => {
  try {
    const response = await API.get("/api/admin/retailer/products/catalog");
    return asApiResult<{ data: AppProduct[] }>(response.status, response.data);
  } catch (error) {
    return asApiError(error, "Unable to fetch products.");
  }
};

export const getAllRetailerProducts = async () => {
  try {
    const response = await API.get("/api/admin/retailer/products");
    return asApiResult<{ data: AppProduct[] }>(response.status, response.data);
  } catch (error) {
    return asApiError(error, "Unable to fetch admin products.");
  }
};

export const getMyBills = async () => {
  try {
    const response = await API.get("/api/admin/retailer/bills/my-bills");
    return asApiResult<{ data: AppBill[] }>(response.status, response.data);
  } catch (error) {
    return asApiError(error, "Unable to fetch bills.");
  }
};

export const getAllRetailerBills = async () => {
  try {
    const response = await API.get("/api/admin/retailer/bills/all");
    return asApiResult<{ data: AppBill[] }>(response.status, response.data);
  } catch (error) {
    return asApiError(error, "Unable to fetch retailer bills.");
  }
};

export const markRetailerBillsAsCompleted = async (billIds: string[]) => {
  try {
    const response = await API.patch("/api/admin/retailer/bills/complete", { billIds });
    return asApiResult(response.status, response.data);
  } catch (error) {
    return asApiError(error, "Unable to mark bills as completed.");
  }
};

export const getAllDealerBills = async (filters?: {
  fromDate?: string;
  toDate?: string;
}) => {
  try {
    const response = await API.get("/api/admin/dealer/bills", {
      params: {
        fromDate: filters?.fromDate,
        toDate: filters?.toDate,
      },
    });
    return asApiResult<{ data: DealerBill[] }>(response.status, response.data);
  } catch (error) {
    return asApiError(error, "Unable to fetch dealer bills.");
  }
};

export const getAllDealerPayments = async (filters?: {
  fromDate?: string;
  toDate?: string;
}) => {
  try {
    const response = await API.get("/api/admin/dealer/payments", {
      params: {
        fromDate: filters?.fromDate,
        toDate: filters?.toDate,
      },
    });
    return asApiResult<{ data: DealerPayment[] }>(response.status, response.data);
  } catch (error) {
    return asApiError(error, "Unable to fetch dealer payments.");
  }
};

export const createBill = async (data: {
  routeId: string;
  shopId: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
}) => {
  try {
    const response = await API.post("/api/admin/retailer/bills", data);
    return asApiResult<{ data: AppBill }>(response.status, response.data);
  } catch (error) {
    return asApiError(error, "Unable to create bill.");
  }
};

export const createAdminRetailerBill = async (data: {
  routeId: string;
  shopId: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
}) => {
  try {
    const response = await API.post("/api/admin/retailer/bills", data);
    return asApiResult<{ data: AppBill }>(response.status, response.data);
  } catch (error) {
    return asApiError(error, "Unable to create retailer bill.");
  }
};

export const updateBillById = async (
  id: string,
  data: {
    routeId: string;
    shopId: string;
    items: Array<{
      productId: string;
      quantity: number;
    }>;
  }
) => {
  try {
    const response = await API.put(`/api/admin/retailer/bills/${id}`, data);
    return asApiResult<{ data: AppBill }>(response.status, response.data);
  } catch (error) {
    return asApiError(error, "Unable to update bill.");
  }
};

export const deleteBillById = async (id: string) => {
  try {
    const response = await API.delete(`/api/admin/retailer/bills/${id}`);
    return asApiResult(response.status, response.data);
  } catch (error) {
    return asApiError(error, "Unable to delete bill.");
  }
};

export const getAllDealerProducts = async () => {
  try {
    const response = await API.get("/api/admin/dealer/products");
    return asApiResult<{ data: DealerProduct[] }>(response.status, response.data);
  } catch (error) {
    return asApiError(error, "Unable to fetch dealer products.");
  }
};

export const createAdminDealerBill = async (data: {
  dealerId: string;
  billDate: string;
  kattaCount: number;
  items: Array<{
    productId?: string;
    productName?: string;
    mrp?: number;
    productRate?: number;
    amount?: number;
    quantity: number;
  }>;
}) => {
  try {
    const response = await API.post("/api/admin/dealer/bills", data);
    return asApiResult<{ data: DealerBill }>(response.status, response.data);
  } catch (error) {
    return asApiError(error, "Unable to create dealer bill.");
  }
};

export const updateAdminDealerBill = async (
  id: string,
  data: {
    dealerId: string;
    billDate: string;
    kattaCount: number;
    items: Array<{
      productId?: string;
      productName?: string;
      mrp?: number;
      productRate?: number;
      amount?: number;
      quantity: number;
    }>;
  },
) => {
  try {
    const response = await API.put(`/api/admin/dealer/bills/${id}`, data);
    return asApiResult<{ data: DealerBill }>(response.status, response.data);
  } catch (error) {
    return asApiError(error, "Unable to update dealer bill.");
  }
};

export const getStaffAttendanceHistory = async () => {
  const result = await getWithFallback<unknown>(
    ["/api/auth/attendance", "/api/admin/attendance"],
    "Unable to fetch attendance history.",
  );

  if (!result.ok) {
    return result as ApiResult<{ data: AttendanceEntry[] }>;
  }

  return {
    ...result,
    data: {
      data: extractAttendanceEntries(result.data),
    },
  } satisfies ApiResult<{ data: AttendanceEntry[] }>;
};

export const markStaffAttendance = async (action: AttendanceAction) => {
  return markStaffAttendanceWithLocation(action, {});
};

export const markStaffAttendanceWithLocation = async (
  action: AttendanceAction,
  data: {
    latitude?: number;
    longitude?: number;
  },
) => {
  const requestBody = {
    latitude: data.latitude,
    longitude: data.longitude,
  };
  const endpoints = (() => {
    switch (action) {
      case "in":
        return ["/api/auth/attendance/check-in"];
      case "out":
        return ["/api/auth/attendance/check-out"];
      case "break-in":
        return ["/api/auth/attendance/break-in"];
      case "break-out":
        return ["/api/auth/attendance/break-out"];
      default:
        return ["/api/auth/attendance/check-in"];
    }
  })();
  const fallbackMessage = (() => {
    switch (action) {
      case "in":
        return "Unable to mark check-in.";
      case "out":
        return "Unable to mark check-out.";
      case "break-in":
        return "Unable to mark break-in.";
      case "break-out":
        return "Unable to mark break-out.";
      default:
        return "Unable to mark attendance.";
    }
  })();

  let lastError: unknown = null;

  try {
    for (const endpoint of endpoints) {
      try {
        const response = await API.post(endpoint, requestBody);
        return asApiResult(response.status, response.data);
      } catch (error) {
        lastError = error;
        return asApiError(error, fallbackMessage);
      }
    }
  } catch (error) {
    lastError = error;
  }

  return asApiError(lastError, fallbackMessage);
};

