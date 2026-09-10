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
export { normalizeProps, ImagerComponentProps, NormalizedCall } from "./component";
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
