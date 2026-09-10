/** Класс ImagerServer — серверная часть клиента imager (TypeScript).

Расширяет клиентский класс Imager (src/imager-ts) приватными полем token
и админ-методами AdminGenerate/AdminDelete.

Только эта часть знает token: она живёт в отдельном каталоге
(src/imager-ts-server) и физически не попадает в браузерную сборку —
браузерные сборщики резолвят условие `browser` в package.json exports
и не включают imager-server в бандл.

HTTP: fetch (Node 18+), без внешних зависимостей.
Простая обработка ошибок: сеть/код ответа/пустой token/adminURL → false.
*/
import { Imager } from "../imager-ts/Imager";
import { AssetType, ImagerServerOptions } from "../imager-ts/ImagerTypes";

export { AssetType, ImagerServerOptions } from "../imager-ts/ImagerTypes";

export class ImagerServer extends Imager {
    private _token: string;
    private _adminURL: string;

    constructor(options?: ImagerServerOptions | null) {
        super(options);
        const o = options && typeof options === "object" ? options : {};

        // token
        this._token =
            o.token === null || o.token === undefined ? "" : String(o.token);

        // adminURL — без завершающего `/`
        const admin = o.adminURL === null || o.adminURL === undefined ? "" : String(o.adminURL);
        if (admin === "") {
            this._adminURL = "";
        } else {
            this._adminURL = admin.endsWith("/") ? admin.slice(0, -1) : admin;
        }
    }

    /** POST {adminURL}/admin/assets/generate → True на 200/202. */
    async AdminGenerate(
        target: string | AssetType | AssetType[] | string[],
        wait?: boolean,
    ): Promise<boolean> {
        return this._adminRequest(target, wait, "/admin/assets/generate", "POST");
    }

    /** DELETE {adminURL}/admin/assets/delete → True на 200. */
    async AdminDelete(
        target: string | AssetType | AssetType[] | string[],
        wait?: boolean,
    ): Promise<boolean> {
        return this._adminRequest(target, wait, "/admin/assets/delete", "DELETE");
    }

    private async _adminRequest(
        target: string | AssetType | AssetType[] | string[],
        wait: boolean | undefined,
        endpoint: string,
        method: string,
    ): Promise<boolean> {
        // пустой token/adminURL → false без HTTP-запроса
        if (!this._token || !this._adminURL) {
            return false;
        }

        let body: Record<string, unknown>;
        if (typeof target === "string") {
            // режим A: source-строка как есть
            body = { source: target };
        } else {
            // режим B: собираем список assets
            let assets: string[];
            if (Array.isArray(target)) {
                if (target.length > 0 && typeof target[0] === "string") {
                    // string[] — пути как есть, без валидации и преобразований
                    assets = (target as string[]).slice();
                } else {
                    // AssetType[] — path'ы всех AssetType подряд
                    assets = (target as AssetType[]).flatMap((at) => at.paths.map((p) => p.path));
                }
            } else {
                // AssetType — все paths[].path
                assets = target.paths.map((p) => p.path);
            }
            body = { assets };
        }
        body.wait = wait === undefined ? false : wait;

        try {
            const response = await fetch(this._adminURL + endpoint, {
                method,
                headers: {
                    Authorization: "Bearer " + this._token,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
            });
            const code = response.status;
            if (endpoint === "/admin/assets/delete") {
                return code === 200;
            }
            return code === 200 || code === 202;
        } catch {
            // ошибка сети / non-HTTP → false
            return false;
        }
    }
}

export default ImagerServer;
