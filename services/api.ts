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
  roleId: 1 | 2;
  isActive?: boolean;
};

export type AppRoute = {
  _id: string;
  routeName: string;
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

export type UploadImageFile = {
  uri: string;
  name?: string;
  mimeType?: string;
  size?: number;
};

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  roleId: 1 | 2;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
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
      !("roleId" in user)
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
      roleId: Number(user.roleId) === 1 ? 1 : 2,
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
  roleId: 1 | 2;
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

export const loginuser = async (data: { email: string; password: string }) => {
  try {
    const response = await API.post("/api/auth/login", data);

    const token =
      typeof response.data === "object" &&
      response.data !== null &&
      "token" in response.data
        ? String((response.data as { token?: unknown }).token || "")
        : "";

    if (token) {
      setAuthToken(token);
    }

    // Reset cached user each login attempt, then set only when payload is valid.
    setCurrentUser(null);

    const userData =
      typeof response.data === "object" &&
      response.data !== null &&
      "user" in response.data
        ? (response.data as { user?: unknown }).user
        : null;

    if (userData && typeof userData === "object") {
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
      if (roleId === 1 || roleId === 2) {
        const isActiveRaw =
          "isActive" in userData ? (userData as { isActive?: unknown }).isActive : true;
        const user = {
          id: String(idRaw ?? ""),
          name: String(nameRaw ?? ""),
          email: String(emailRaw ?? ""),
          roleId,
          isActive: isActiveRaw !== false,
        };
        setCurrentUser(user);
        if (token) {
          await persistAuthSession({
            token,
            user,
            expiresAt: Date.now() + ONE_DAY_MS,
          });
        }
      }
    }

    return asApiResult(response.status, response.data);
  } catch (error) {
    return asApiError(error, "Unable to login. Please try again.");
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

export const register = async (
  name: string,
  email: string,
  password: string,
  roleId: 1 | 2 = 2,
) => registerUser({ name, email, password, roleId });

export const login = async (email: string, password: string) =>
  loginuser({ email, password });

export const createAdminRoute = async (routeName: string) => {
  try {
    const response = await API.post("/api/admin/routes", { routeName });
    return asApiResult<{ data: AppRoute }>(response.status, response.data);
  } catch (error) {
    return asApiError(error, "Unable to create route.");
  }
};

export const getAllAdminRoutes = async () => {
  try {
    const response = await API.get("/api/admin/routes");
    return asApiResult<{ data: AppRoute[] }>(response.status, response.data);
  } catch (error) {
    return asApiError(error, "Unable to fetch routes.");
  }
};

export const getAdminRouteById = async (id: string) => {
  try {
    const response = await API.get(`/api/admin/routes/${id}`);
    return asApiResult<{ data: AppRoute }>(response.status, response.data);
  } catch (error) {
    return asApiError(error, "Unable to fetch route.");
  }
};

export const updateAdminRouteById = async (id: string, routeName: string) => {
  try {
    const response = await API.put(`/api/admin/routes/${id}`, { routeName });
    return asApiResult<{ data: AppRoute }>(response.status, response.data);
  } catch (error) {
    return asApiError(error, "Unable to update route.");
  }
};

export const deleteAdminRouteById = async (id: string) => {
  try {
    const response = await API.delete(`/api/admin/routes/${id}`);
    return asApiResult(response.status, response.data);
  } catch (error) {
    return asApiError(error, "Unable to delete route.");
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
    const hasImage = Boolean(data.imageFile?.uri);

    if (hasImage) {
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
        data.imageFile.name ||
        data.imageFile.uri.split("/").pop() ||
        `shop-image-${Date.now()}.jpg`;
      const mimeType =
        data.imageFile.mimeType ||
        (imageName.toLowerCase().endsWith(".png")
          ? "image/png"
          : imageName.toLowerCase().endsWith(".webp")
          ? "image/webp"
          : "image/jpeg");
      formData.append("image", {
        uri: data.imageFile.uri,
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

export const getAdminShops = async () => {
  try {
    const response = await API.get("/api/admin/shops");
    return asApiResult<{ data: AppShop[] }>(response.status, response.data);
  } catch (error) {
    return asShopApiError(error, "Unable to fetch shops.");
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
    const hasImage = Boolean(data.imageFile?.uri);

    if (hasImage) {
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
        data.imageFile.name ||
        data.imageFile.uri.split("/").pop() ||
        `shop-image-${Date.now()}.jpg`;
      const mimeType =
        data.imageFile.mimeType ||
        (imageName.toLowerCase().endsWith(".png")
          ? "image/png"
          : imageName.toLowerCase().endsWith(".webp")
          ? "image/webp"
          : "image/jpeg");
      formData.append("image", {
        uri: data.imageFile.uri,
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

const asAdminUser = (value: unknown): AdminUser | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const raw = value as Record<string, unknown>;
  const role = Number(raw.roleId);
  if (role !== 1 && role !== 2) {
    return null;
  }
  return {
    id: String(raw._id ?? raw.id ?? ""),
    name: String(raw.name ?? ""),
    email: String(raw.email ?? ""),
    roleId: role,
    isActive: raw.isActive !== false,
    createdAt: String(raw.createdAt ?? ""),
    updatedAt: String(raw.updatedAt ?? ""),
  };
};

export const getAdminUsers = async (): Promise<ApiResult<{ data: AdminUser[] }>> => {
  try {
    const response = await API.get("/api/admin/users");
    const payload = response.data as { data?: unknown };
    const users = Array.isArray(payload?.data)
      ? payload.data.map(asAdminUser).filter(Boolean)
      : [];

    return {
      ok: true,
      status: response.status,
      data: { data: users as AdminUser[] },
      message: getApiErrorMessage(response.data) || "Users fetched successfully",
    };
  } catch (error) {
    return asApiError(error, "Unable to fetch users.") as ApiResult<{ data: AdminUser[] }>;
  }
};

export const updateAdminUserStatus = async (
  id: string,
  isActive: boolean,
): Promise<ApiResult<{ data: AdminUser }>> => {
  try {
    const response = await API.patch(`/api/admin/users/${id}/status`, { isActive });
    const payload = response.data as { data?: unknown };
    const user = asAdminUser(payload?.data);
    return {
      ok: true,
      status: response.status,
      data: user ? { data: user } : null,
      message: getApiErrorMessage(response.data) || "User status updated",
    };
  } catch (error) {
    return asApiError(error, "Unable to update user status.") as ApiResult<{ data: AdminUser }>;
  }
};

