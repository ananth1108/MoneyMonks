// static/js/api.js

// Optional: set API base via <meta name="api-base" content="/api-prefix">
const API_BASE =
    document.querySelector('meta[name="api-base"]')?.content?.trim() || "";

// Build query string from params
function toQuery(params = {}) {
    const usp = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
            usp.append(key, value);
        }
    });
    const qs = usp.toString();
    return qs ? `?${qs}` : "";
}

// Generic HTTP request helper
async function request(method, path, { params, body } = {}) {
    const url = `${API_BASE}${path}${toQuery(params)}`;

    const options = {
        method,
        headers: {},
    };

    if (body !== undefined) {
        options.headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(body);
    }

    let res;
    try {
        res = await fetch(url, options);
    } catch (err) {
        throw new Error(`Network error for ${method} ${path}: ${err.message}`);
    }

    if (!res.ok) {
        let message = "";
        try {
            // Try to parse JSON error payload
            const errJson = await res.json();
            message =
                errJson?.message ||
                errJson?.error ||
                JSON.stringify(errJson).slice(0, 200);
        } catch {
            // Fallback: plain text
            const text = await res.text();
            message = text.slice(0, 200);
        }
        throw new Error(
            `${method} ${path} failed: ${res.status} ${res.statusText}${
                message ? ` - ${message}` : ""
            }`
        );
    }

    // No content (e.g. 204) or non-JSON: return null
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
        return null;
    }

    try {
        return await res.json();
    } catch {
        return null;
    }
}

// Thin wrappers
export function apiGet(path, params) {
    return request("GET", path, { params });
}

export function apiPost(path, body) {
    return request("POST", path, { body });
}

export function apiPut(path, body) {
    return request("PUT", path, { body });
}

export function apiDelete(path, params) {
    // Optional params for DELETE (?id= etc.)
    return request("DELETE", path, { params });
}

// Shared utilities
const inrFormatter = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

export function formatCurrency(amount) {
    const num = Number(amount);
    if (Number.isNaN(num)) {
        return inrFormatter.format(0);
    }
    return inrFormatter.format(num);
}

export function todayISO() {
    return new Date().toISOString().slice(0, 10);
}
