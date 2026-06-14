import axios, { AxiosError } from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE_URL_FROM_ENV = process.env.EXPO_PUBLIC_API_URL;

if (!API_BASE_URL_FROM_ENV) {
  throw new Error("Missing EXPO_PUBLIC_API_URL in .env");
}

const normalizeApiUrl = (url: string) => url.trim().replace(/\/+$/, "");

export const API_BASE_URL = normalizeApiUrl(API_BASE_URL_FROM_ENV);
const AUTH_STORAGE_KEY = "auth_session_v1";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

let authToken = "";
let currentUser: AuthUser | null = null;
let authHydrated = false;

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  roleId: 2;
  isActive?: boolean;
};

export type AppRoute = {
  _id: string;
  userId: string;
  routeName: string;
  cityName: string;
  createdAt: string;
  updatedAt: string;
};

export type AppShop = {
  _id: string;
  shopName: string;
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
  productName: string;
  mrp: number;
  productRate: number;
  createdAt: string;
  updatedAt: string;
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
  routeId: string | AppRoute;
  shopId: string | AppShop;
  items: AppBillItem[];
  totalAmount: number;
  status: "ordered" | "processing" | "delivered" | "cancelled";
  createdAt: string;
  updatedAt: string;
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

const persistAuthSession = async (payload: {
  token: string;
  user: AuthUser;
  expiresAt: number;
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
    if (!expiresAt || Date.now() > expiresAt) {
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
      !("email" in user) ||
      !("roleId" in user) ||
      Number(user.roleId) !== 2
    ) {
      clearAuthToken();
      authHydrated = true;
      return;
    }

    authToken = token;
    currentUser = {
      id: String(user.id),
      name: String(user.name),
      email: String(user.email),
      roleId: 2,
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

const extractRoleTwoUser = (payload: unknown): AuthUser | null => {
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

  const nameRaw = "name" in userData ? (userData as { name?: unknown }).name : undefined;
  const emailRaw = "email" in userData ? (userData as { email?: unknown }).email : undefined;
  const roleId = Number(roleRaw);

  if (roleId !== 2) {
    return null;
  }

  const isActiveRaw =
    "isActive" in userData ? (userData as { isActive?: unknown }).isActive : true;

  return {
    id: String(idRaw ?? ""),
    name: String(nameRaw ?? ""),
    email: String(emailRaw ?? ""),
    roleId: 2,
    isActive: isActiveRaw !== false,
  };
};

const finalizeRoleTwoSession = async (payload: LoginResponse) => {
  const token = typeof payload.token === "string" ? payload.token : "";
  if (!token) {
    return {
      ok: false,
      status: 500,
      data: payload,
      message: "Login response did not include a token.",
    } satisfies ApiResult<LoginResponse>;
  }

  const user = extractRoleTwoUser(payload);
  if (!user) {
    clearAuthToken();
    return {
      ok: false,
      status: 403,
      data: payload,
      message: "This mobile app is available only for role 2 accounts.",
    } satisfies ApiResult<LoginResponse>;
  }

  setAuthToken(token);
  setCurrentUser(user);
  await persistAuthSession({
    token,
    user,
    expiresAt: Date.now() + ONE_DAY_MS,
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

export const loginuser = async (data: { email: string; password: string }) => {
  try {
    const response = await API.post<LoginResponse>("/api/auth/login", data);
    setCurrentUser(null);
    clearAuthToken();

    if (response.data?.requiresVerification) {
      return asApiResult<LoginResponse>(response.status, response.data);
    }

    const finalized = await finalizeRoleTwoSession(response.data ?? {});
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

    const finalized = await finalizeRoleTwoSession(response.data ?? {});
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

export const register = async (
  name: string,
  email: string,
  password: string,
) => registerUser({ name, email, password, roleId: 2 });

export const login = async (email: string, password: string) =>
  loginuser({ email, password });

export const createRoute = async (routeName: string, cityName: string) => {
  try {
    const response = await API.post("/api/admin/routes", { routeName, cityName });
    return asApiResult<{ data: AppRoute }>(response.status, response.data);
  } catch (error) {
    return asApiError(error, "Unable to create route.");
  }
};

export const getMyRoutes = async () => {
  try {
    const response = await API.get("/api/admin/routes");
    return asApiResult<{ data: AppRoute[] }>(response.status, response.data);
  } catch (error) {
    return asApiError(error, "Unable to fetch routes.");
  }
};

export const createShop = async (data: {
  routeId: string;
  shopName: string;
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

      const result = await executeShopMultipartRequest("POST", "/api/admin/shops", formData);
      return result as ApiResult<{ data: AppShop }>;
    }

    const response = await API.post("/api/admin/shops", {
      routeId: data.routeId,
      shopName: data.shopName,
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
    const response = await API.get("/api/admin/shops/my-shops");
    return asApiResult<{ data: AppShop[] }>(response.status, response.data);
  } catch (error) {
    return asShopApiError(error, "Unable to fetch your shops.");
  }
};

export const getShopRoutes = async () => {
  try {
    const response = await API.get("/api/admin/shops/routes");
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

      const result = await executeShopMultipartRequest("PUT", `/api/admin/shops/${id}`, formData);
      return result as ApiResult<{ data: AppShop }>;
    }

    const response = await API.put(`/api/admin/shops/${id}`, {
      routeId: data.routeId,
      shopName: data.shopName,
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
    const response = await API.delete(`/api/admin/shops/${id}`);
    return asApiResult(response.status, response.data);
  } catch (error) {
    return asShopApiError(error, "Unable to delete shop.");
  }
};

export const getBillProducts = async () => {
  try {
    const response = await API.get("/api/admin/products/catalog");
    return asApiResult<{ data: AppProduct[] }>(response.status, response.data);
  } catch (error) {
    return asApiError(error, "Unable to fetch products.");
  }
};

export const getMyBills = async () => {
  try {
    const response = await API.get("/api/admin/bills/my-bills");
    return asApiResult<{ data: AppBill[] }>(response.status, response.data);
  } catch (error) {
    return asApiError(error, "Unable to fetch bills.");
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
    const response = await API.post("/api/admin/bills", data);
    return asApiResult<{ data: AppBill }>(response.status, response.data);
  } catch (error) {
    return asApiError(error, "Unable to create bill.");
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
    const response = await API.put(`/api/admin/bills/${id}`, data);
    return asApiResult<{ data: AppBill }>(response.status, response.data);
  } catch (error) {
    return asApiError(error, "Unable to update bill.");
  }
};

export const deleteBillById = async (id: string) => {
  try {
    const response = await API.delete(`/api/admin/bills/${id}`);
    return asApiResult(response.status, response.data);
  } catch (error) {
    return asApiError(error, "Unable to delete bill.");
  }
};

