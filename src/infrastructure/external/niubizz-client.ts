import 'server-only';

const IS_LOCAL = process.env.NODE_ENV !== "production";

const PROXY_URL = process.env.IIMP_PROXY_URL ?? "https://services.iimp.org.pe";
const PROXY_IP = process.env.IIMP_PROXY_IP ?? "";
const PROXY_PASS = process.env.IIMP_PROXY_PASS ?? "";
const SANDBOX_API = process.env.NIUBIZZ_URL_API ?? "https://apisandbox.vnforappstest.com";
const MERCHANT_ID = process.env.NIUBIZZ_MERCHANT_ID ?? "";
const SANDBOX_USER = process.env.NIUBIZZ_USER ?? "";
const SANDBOX_PASS = process.env.NIUBIZZ_PASSWORD ?? "";

async function getSandboxToken(): Promise<string> {
  const auth = Buffer.from(`${SANDBOX_USER}:${SANDBOX_PASS}`).toString("base64");
  const res = await fetch(`${SANDBOX_API}/api.security/v1/security`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
  });
  if (!res.ok) throw new Error(`Security error: ${res.status}`);
  return (await res.text()).trim();
}

async function postJson<T>(url: string, body: unknown, headers?: Record<string, string>): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Error externo: ${res.status}`);
  return res.json() as Promise<T>;
}

async function createSessionViaProxy(params: Record<string, unknown>) {
  return postJson<{ k: string; frm: string; numero_orden?: string }>(
    `${PROXY_URL}/niubiz.php`,
    {
      ipAddress: PROXY_IP, accessKey: PROXY_PASS, serviceKey: "niubiz_tarjeta",
      event: "proexplo", id_event: "6", siecode_event: "28",
      data: { ...params, process: "get_form", raw_data: true },
    },
  );
}

async function createSessionViaSandbox(params: Record<string, unknown>) {
  try {
    const token = await getSandboxToken();
    return postJson<{ sessionKey: string }>(
      `${SANDBOX_API}/api.ecommerce/v2/token-session/${MERCHANT_ID}`,
      {
        amount: params.amount, purchaseNumber: params.purchasenumber,
        email: params.email, firstName: params.nombre, lastName: params.apellido,
        phoneNumber: params.telefono || "000000000",
        identityDocument: { type: "DNI", number: (params.numerodocumento as string) || "00000000" },
      },
      { Authorization: `Bearer ${token}` },
    );
  } catch {
    // Mock session for local development (sandbox not reachable from localhost)
    return {
      sessionKey: `LOCAL_DEV_${Date.now()}`,
    };
  }
}

export const niubizzClient = {
  async crearSesion(params: {
    amount: number; purchaseNumber: string; nombre: string; apellido: string;
    email: string; documento: string; telefono: string; urlCallback: string; urlTimeout: string;
  }) {
    if (IS_LOCAL) {
      const result = await createSessionViaSandbox(params);
      return { k: result.sessionKey, frm: "", numero_orden: params.purchaseNumber };
    }
    return createSessionViaProxy(params);
  },

  async autorizar(params: {
    key: string; amount: number; transactionToken: string; purchaseNumber: string;
  }) {
    if (IS_LOCAL) {
      if (params.key.startsWith("LOCAL_DEV_")) {
        // Mocked session — return success
        return { success: true };
      }
      try {
        const token = await getSandboxToken();
        return postJson(`${SANDBOX_API}/api.authorization/v1/authorization/${MERCHANT_ID}`, {
          amount: params.amount, purchaseNumber: params.purchaseNumber,
          transactionToken: params.transactionToken,
        }, { Authorization: `Bearer ${token}` });
      } catch {
        return { success: true }; // Mock success for local dev
      }
    }
    return postJson(`${PROXY_URL}/niubiz.php`, {
      ipAddress: PROXY_IP, accessKey: PROXY_PASS, serviceKey: "niubiz_tarjeta",
      event: "proexplo", id_event: "6", siecode_event: "28",
      data: {
        process: "get_authorization", key: params.key, amount: params.amount,
        token: params.transactionToken, purchasenumber: params.purchaseNumber, website: "",
      },
    });
  },
};
