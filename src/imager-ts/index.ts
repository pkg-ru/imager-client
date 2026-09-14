/*! @license
 * imager-client — клиент микросервиса Imager
 * Репозиторий: https://gitverse.ru/pkg-ru/imager-client (зеркало: https://github.com/pkg-ru/imager-client)
 * Автор: Vladislav Altukhov (https://altuh.ru/about)
 * Демо: https://altuh.ru/demo/imager
 */
/** Точка входа клиентской (браузерной) части imager-client.

Экспортирует только клиентские методы/типы — без служебных полей
и админ-методов серверной части.
*/
export { Imager } from "./Imager";
export { default } from "./Imager";
export {
    AssetPath,
    AssetType,
    ImagerOptions,
    Segment,
    mimeFor,
} from "./ImagerTypes";
export {
    normalizeProps,
    ImagerComponentProps,
    NormalizedCall,
    NormalizePropsOptions,
} from "./component";
export {
    IMG_ATTRS,
    HtmlGroup,
    buildSrcset,
    fmtDescriptor,
    groupAssets,
    pickImgGroup,
    splitAttrs,
    useWidthDescriptors,
} from "./render";
