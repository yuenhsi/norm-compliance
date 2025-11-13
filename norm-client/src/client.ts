const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

// keep in sync with Pydantic class defined in app.py
export interface Node {
    id: number;
    type: string;
    name: string;
    status?: string | null;
    reason?: string | null;
    children: Node[];
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${API_BASE_URL}${path}`, {
        headers: { "Content-Type": "application/json" },
        ...options,
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
    }

    return res.json() as Promise<T>;
}

export const api = {
    getTree: () => request<Node>("/"),
    patchNode: (id: number, status?: string, reason?: string) =>
        request<Node[]>(`/nodes/${id}`, {
            method: "PATCH",
            body: JSON.stringify({ status, reason }),
        }),
    getNode: (id: number) => request<Node>(`/nodes/${id}`),
};
