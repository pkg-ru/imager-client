/*! @license
 * imager-client — клиент микросервиса Imager
 * Репозиторий: https://gitverse.ru/pkg-ru/imager-client (зеркало: https://github.com/pkg-ru/imager-client)
 * Автор: Vladislav Altukhov (https://altuh.ru/about)
 * Демо: https://altuh.ru/demo/imager
 */
/** Точка входа серверной части imager-client (`imager-client/server`). */
export { ImagerServer } from "./ImagerServer";
export { Imager } from "../imager-ts/Imager";
export {
    AssetPath,
    AssetType,
    ImagerOptions,
    ImagerServerOptions,
    Segment,
    mimeFor,
} from "../imager-ts/ImagerTypes";
