import { useEffect, useRef, useState } from "react";
import { Button, DetailSection, StatePanel } from "@trise/ui";
import { OperationsDialog } from "./operations-dialog";
import { OperationsStatus as Status } from "./operations-status";
import {
  operationsData,
  type DocumentTransfer,
  type ProviderDocument,
} from "./data";
import { SvgIcon } from "./icons";
import {
  humanFileSize,
  PROVIDER_DOCUMENT_MAX_BYTES,
  PROVIDER_DOCUMENT_MEDIA_TYPES,
  WORK_INTAKE_PHOTO_MEDIA_TYPES,
  providerDocumentFileError,
  providerDocumentMediaType,
  sha256Hex,
  workIntakeDocumentFileError,
  workIntakePhotoFileError,
} from "./provider-document-upload";
import { formatIndiaDateTime } from "./subscription-support";
import { ProviderActionMenu } from "./operations-shared";

type PendingUpload = {
  file: File;
  checksum: string;
  requestKey: string;
  documentId: string;
  versionId: string;
  transfer: DocumentTransfer;
  uploaded: boolean;
};
type ReplaceableDocument = {
  id: string;
  attributes: {
    filename: string;
    media_type: string;
    size_bytes: number;
    classification: string;
    status: string;
    current_version_id?: string | null;
    revision: number;
  };
};
const OFFICE_MEDIA_TYPES = new Set([
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);
const officeLabel = (mediaType: string) =>
  mediaType.includes("spreadsheet") || mediaType === "application/vnd.ms-excel"
    ? "Excel workbook"
    : "Word document";
type AssetKind = "PHOTO" | "PDF" | "DOC" | "XLS" | "FILE";
const assetKind = (mediaType: string): AssetKind =>
  mediaType.startsWith("image/")
    ? "PHOTO"
    : mediaType === "application/pdf"
      ? "PDF"
      : mediaType.includes("spreadsheet") ||
          mediaType === "application/vnd.ms-excel"
        ? "XLS"
        : mediaType.includes("word") || mediaType === "application/msword"
          ? "DOC"
          : "FILE";
const assetKindLabel = (mediaType: string) =>
  ({
    PHOTO: "Image / photo",
    PDF: "PDF document",
    DOC: "Word document",
    XLS: "Excel workbook",
    FILE: "Document",
  })[assetKind(mediaType)];
const assetKindClass = (mediaType: string) =>
  `asset-kind-${assetKind(mediaType).toLowerCase()}`;

function AssetTypeNav({
  assetTab,
  counts,
  onSelect,
}: {
  assetTab: "images" | "documents";
  counts: { images: number; documents: number };
  onSelect: (tab: "images" | "documents") => void;
}) {
  return (
    <nav
      className="provider-intake-asset-tabs work-intake-asset-sidebar"
      aria-label="Asset type"
    >
      <button
        type="button"
        className={assetTab === "images" ? "is-active" : ""}
        aria-current={assetTab === "images" ? "page" : undefined}
        onClick={() => onSelect("images")}
      >
        <SvgIcon name="grid" size={16} />
        <span>Images</span>
        <small>{counts.images}</small>
      </button>
      <button
        type="button"
        className={assetTab === "documents" ? "is-active" : ""}
        aria-current={assetTab === "documents" ? "page" : undefined}
        onClick={() => onSelect("documents")}
      >
        <SvgIcon name="clipboard" size={16} />
        <span>Documents</span>
        <small>{counts.documents}</small>
      </button>
    </nav>
  );
}

function uploadFailure(response: Response): Error {
  if (response.status === 403)
    return new Error(
      "Private storage denied this upload. Request a new upload or ask an operator to verify the scoped storage permissions.",
    );
  if (response.status === 400)
    return new Error(
      "Private storage rejected the signed upload headers or file metadata.",
    );
  return new Error(
    `Private storage rejected the upload (HTTP ${response.status}).`,
  );
}

export function ProviderDocumentsStep({
  providerId,
  targetId,
  canUpload,
  onChanged,
  showDocumentList = true,
  scope = "platform",
  showUploadHeading = true,
  initialClassification = "BUSINESS_VERIFICATION",
  replaceDocument,
  compactIntake = false,
  intakeType = "photos",
  assetCenter = false,
  uploadOnly = false,
  documentTargetKind,
  activityEvidence = false,
}: {
  providerId: string;
  targetId?: string;
  canUpload: boolean;
  onChanged?: () => void | Promise<void>;
  showDocumentList?: boolean;
  scope?:
    | "platform"
    | "provider"
    | "business"
    | "intake"
    | "lead"
    | "journey";
  showUploadHeading?: boolean;
  initialClassification?: string;
  replaceDocument?: ReplaceableDocument;
  compactIntake?: boolean;
  intakeType?: "photos" | "documents";
  assetCenter?: boolean;
  uploadOnly?: boolean;
  documentTargetKind?:
    | "MARKETING_LEAD"
    | "LEAD_ACTIVITY"
    | "PROVIDER_WORK_FOLLOW_UP"
    | "PROVIDER_WORK_INTAKE"
    | "QUOTATION"
    | "SERVICE_CASE"
    | "SERVICE_REQUEST"
    | "SERVICE_JOB"
    | "MAINTENANCE_CONTRACT";
  activityEvidence?: boolean;
}) {
  const [documents, setDocuments] = useState<ProviderDocument[]>([]);
  const [selected, setSelected] = useState<File | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [pending, setPending] = useState<PendingUpload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [classification, setClassification] = useState(initialClassification);
  const [otherClassification, setOtherClassification] = useState("");
  const [uploadOpen, setUploadOpen] = useState(uploadOnly);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryUrls, setGalleryUrls] = useState<Record<string, string>>({});
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [preview, setPreview] = useState<{
    document: ProviderDocument;
    url: string;
  } | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [assetTab, setAssetTab] = useState<"images" | "documents">(
    intakeType === "documents" ? "documents" : "images",
  );
  const [assetCounts, setAssetCounts] = useState({ images: 0, documents: 0 });
  const scopedAssetMode =
    scope === "intake" || scope === "lead" || scope === "journey";
  const activeIntakeType = assetCenter
    ? assetTab === "documents"
      ? "documents"
      : "photos"
    : uploadOnly && scopedAssetMode
      ? assetTab === "documents"
        ? "documents"
        : "photos"
      : scopedAssetMode
        ? intakeType
        : "documents";
  const input = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);

  async function openDocument(document: ProviderDocument) {
    if (!document.attributes.current_version_id) return;
    setError("");
    try {
      const transfer =
        scope === "business"
          ? await operationsData.authorizePlatformBusinessDocumentDownload(
              providerId,
              document.id,
              document.attributes.current_version_id,
              crypto.randomUUID(),
              "inline",
            )
          : scope === "provider" ||
              scope === "intake" ||
              scope === "lead" ||
              scope === "journey"
            ? await operationsData.authorizeProviderDocumentDownload(
                providerId,
                document.id,
                document.attributes.current_version_id,
                crypto.randomUUID(),
                "inline",
              )
            : await operationsData.authorizePlatformDocumentDownload(
                providerId,
                document.id,
                document.attributes.current_version_id,
                crypto.randomUUID(),
                "inline",
              );
      setPreview({ document, url: transfer.url });
      setPreviewIndex(documents.findIndex((item) => item.id === document.id));
    } catch (cause) {
      setError(
        (cause as { message?: string })?.message ||
          "The private document transfer could not be authorized.",
      );
    }
  }

  function movePreview(direction: -1 | 1) {
    if (previewIndex === null) return;
    const previewable = documents.filter(
      (document) => document.attributes.current_version_id,
    );
    const currentPosition = previewable.findIndex(
      (document) => document.id === preview?.document.id,
    );
    if (currentPosition < 0) return;
    const nextPosition =
      (currentPosition + direction + previewable.length) % previewable.length;
    void openDocument(previewable[nextPosition]);
  }

  function previewSurface(document: ProviderDocument, url: string) {
    if (document.attributes.media_type.startsWith("image/"))
      return <img src={url} alt={document.attributes.filename} />;
    if (document.attributes.media_type === "application/pdf")
      return <iframe src={url} title={document.attributes.filename} />;
    if (OFFICE_MEDIA_TYPES.has(document.attributes.media_type))
      return (
        <div
          className={`provider-document-office-preview ${assetKindClass(document.attributes.media_type)}`}
        >
          <span className="provider-document-office-icon">
            <SvgIcon name="clipboard" size={28} />
          </span>
          <strong>{officeLabel(document.attributes.media_type)}</strong>
          <p>
            This private Office file is shown in a protected preview card.
            Browser rendering is not available for this file type, so download
            is explicit and stays in this modal flow.
          </p>
          <Button
            type="button"
            variant="secondary"
            onClick={() => downloadDocument(document)}
          >
            <SvgIcon name="download" size={15} /> Download explicitly
          </Button>
        </div>
      );
    return (
      <div className="provider-document-office-preview">
        <span className="provider-document-office-icon">
          <SvgIcon name="clipboard" size={28} />
        </span>
        <strong>Document preview</strong>
        <p>This file type is not renderable in the browser.</p>
        <Button
          type="button"
          variant="secondary"
          onClick={() => downloadDocument(document)}
        >
          <SvgIcon name="download" size={15} /> Download explicitly
        </Button>
      </div>
    );
  }

  function downloadDocument(document: ProviderDocument) {
    if (!document.attributes.current_version_id) return;
    void (async () => {
      try {
        const transfer =
          scope === "business"
            ? await operationsData.authorizePlatformBusinessDocumentDownload(
                providerId,
                document.id,
                document.attributes.current_version_id as string,
                crypto.randomUUID(),
                "attachment",
              )
            : scope === "provider" ||
                scope === "intake" ||
                scope === "lead" ||
                scope === "journey"
              ? await operationsData.authorizeProviderDocumentDownload(
                  providerId,
                  document.id,
                  document.attributes.current_version_id as string,
                  crypto.randomUUID(),
                  "attachment",
                )
              : await operationsData.authorizePlatformDocumentDownload(
                  providerId,
                  document.id,
                  document.attributes.current_version_id as string,
                  crypto.randomUUID(),
                  "attachment",
                );
        const anchor = window.document.createElement("a");
        anchor.href = transfer.url;
        anchor.download = document.attributes.filename;
        anchor.rel = "noreferrer";
        anchor.click();
      } catch (cause) {
        setError(
          (cause as { message?: string })?.message ||
            "The private document download could not be authorized.",
        );
      }
    })();
  }

  async function load() {
    if (uploadOnly && !activityEvidence) {
      setLoading(false);
      setDocuments([]);
      return;
    }
    setLoading(true);
    try {
      const result =
        scope === "business"
          ? await operationsData.platformBusinessDocuments(providerId)
          : scope === "provider"
            ? await operationsData.providerDocuments(providerId)
              : scope === "intake"
              ? await operationsData.providerDocuments(providerId, targetId)
                : scope === "journey"
                  ? await operationsData.journeyResourceDocuments(
                      providerId,
                      targetId as string,
                    )
              : scope === "lead" && activityEvidence
                ? await operationsData.journeyActivityDocuments(
                    providerId,
                    targetId as string,
                  )
                : scope === "lead"
                  ? await operationsData.marketingLeadDocuments(
                      providerId,
                      targetId as string,
                    )
                  : await operationsData.platformDocuments(providerId);
      const allDocuments = result.data as ProviderDocument[];
      if (assetCenter && scopedAssetMode)
        setAssetCounts({
          images: allDocuments.filter(
            (document) =>
              document.attributes.media_type.startsWith("image/") ||
              document.attributes.classification === "WORK_INTAKE_PHOTO",
          ).length,
          documents: allDocuments.filter(
            (document) => !document.attributes.media_type.startsWith("image/"),
          ).length,
        });
      const scopedDocuments =
        scope === "intake"
          ? allDocuments.filter(
              (document) =>
                document.attributes.classification ===
                (activeIntakeType === "documents"
                  ? "WORK_INTAKE_DOCUMENT"
                  : "WORK_INTAKE_PHOTO"),
            )
          : scope === "lead"
            ? allDocuments.filter((document) =>
                activeIntakeType === "photos"
                  ? document.attributes.media_type.startsWith("image/") ||
                    document.attributes.classification === "WORK_INTAKE_PHOTO"
                  : !document.attributes.media_type.startsWith("image/") ||
                    document.attributes.classification ===
                      "WORK_INTAKE_DOCUMENT",
              )
            : scope === "journey" && assetCenter
              ? allDocuments.filter((document) =>
                  activeIntakeType === "photos"
                    ? document.attributes.media_type.startsWith("image/") ||
                      document.attributes.classification === "WORK_INTAKE_PHOTO"
                    : !document.attributes.media_type.startsWith("image/") &&
                      !document.attributes.classification.includes("PHOTO"),
                )
            : allDocuments;
      setDocuments(scopedDocuments);
    } catch (cause) {
      setError(
        (cause as { message?: string })?.message ||
          "Provider documents could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }
  function selectAssetTab(tab: "images" | "documents") {
    if (tab === assetTab) return;
    setAssetTab(tab);
    setDocuments([]);
    setGalleryUrls({});
    setGalleryLoading(true);
  }
  function selectUploadType(tab: "images" | "documents") {
    selectAssetTab(tab);
    window.setTimeout(() => input.current?.click(), 0);
  }
  useEffect(() => {
    void load();
  }, [activityEvidence, providerId, targetId, activeIntakeType, uploadOnly]);
  useEffect(() => {
    if (
      (uploadOnly && !activityEvidence) ||
      (!galleryOpen && !assetCenter) ||
      (scope !== "intake" && scope !== "lead" && scope !== "journey")
    )
      return;
    let active = true;
    setGalleryLoading(true);
    Promise.all(
      documents
        .filter((document) => document.attributes.current_version_id)
        .map(async (document) => {
          try {
            const transfer =
              await operationsData.authorizeProviderDocumentDownload(
                providerId,
                document.id,
                document.attributes.current_version_id as string,
                crypto.randomUUID(),
                "inline",
              );
            return [document.id, transfer.url] as const;
          } catch {
            return [document.id, ""] as const;
          }
        }),
    )
      .then((entries) => {
        if (active)
          setGalleryUrls(
            Object.fromEntries(entries.filter((entry) => entry[1])),
          );
      })
      .finally(() => {
        if (active) setGalleryLoading(false);
      });
    return () => {
      active = false;
    };
  }, [activityEvidence, documents, galleryOpen, providerId, scope]);

  function chooseFiles(files: File[]) {
    setError("");
    setMessage("");
    setPending(null);
    if (!files.length) {
      setSelected(null);
      setSelectedFiles([]);
      return;
    }
    const validateFile = (file: File) => {
      if (autoDetectUploadMode) {
        return providerDocumentMediaType(file).startsWith("image/")
          ? workIntakePhotoFileError(file)
          : workIntakeDocumentFileError(file);
      }
      return scopedAssetMode && activeIntakeType === "photos"
        ? workIntakePhotoFileError(file)
        : scopedAssetMode && activeIntakeType === "documents"
          ? workIntakeDocumentFileError(file)
          : providerDocumentFileError(file);
    };
    const invalidFile = files.find((file) => validateFile(file));
    const validation = invalidFile ? validateFile(invalidFile) : "";
    if (validation) {
      setSelected(null);
      setError(validation);
      return;
    }
    setSelectedFiles(files);
    setSelected(files[0]);
  }

  async function uploadIntakePhoto(file: File) {
    if (!targetId)
      throw new Error("This intake is not available for photo upload yet.");
    const checksum = await sha256Hex(file);
    const requestKey = crypto.randomUUID();
    const payload = {
      filename: file.name,
      media_type: providerDocumentMediaType(file),
      size_bytes: file.size,
      checksum,
      classification:
        (autoDetectUploadMode && !providerDocumentMediaType(file).startsWith("image/")) ||
        (!autoDetectUploadMode && activeIntakeType === "documents")
          ? "WORK_INTAKE_DOCUMENT"
          : "WORK_INTAKE_PHOTO",
      owner: {
        type:
          documentTargetKind ||
          (scope === "lead" ? "MARKETING_LEAD" : "PROVIDER_WORK_INTAKE"),
        id: targetId,
      },
      source: {
        type:
          documentTargetKind ||
          (scope === "lead" ? "MARKETING_LEAD" : "PROVIDER_WORK_INTAKE"),
        id: targetId,
      },
      visibility: "internal",
    };
    const created =
      scope === "lead"
        ? await operationsData.createMarketingLeadDocument(
            providerId,
            payload,
            requestKey,
          )
        : await operationsData.createProviderDocument(
            providerId,
            payload,
            requestKey,
          );
    const response = await fetch(created.transfer.url, {
      method: created.transfer.method,
      headers: created.transfer.headers,
      body: file,
      mode: "cors",
      credentials: "omit",
    });
    if (!response.ok) throw uploadFailure(response);
    await operationsData.finalizeProviderDocument(
      providerId,
      created.document.id,
      { version_id: created.version.id, checksum, size_bytes: file.size },
      `${requestKey}-finalize`,
    );
  }

  async function upload() {
    if (scopedAssetMode && selectedFiles.length > 1) {
      if (inFlight.current) return;
      inFlight.current = true;
      setBusy(true);
      setError("");
      let remaining = [...selectedFiles];
      try {
        for (const file of selectedFiles) {
          setMessage(
            `Uploading ${assetKindLabel(providerDocumentMediaType(file)).toLowerCase()} ${selectedFiles.length - remaining.length + 1} of ${selectedFiles.length}…`,
          );
          await uploadIntakePhoto(file);
          remaining = remaining.slice(1);
          setSelectedFiles(remaining);
          setSelected(remaining[0] || null);
        }
        await load();
        await onChanged?.();
        setMessage(
          `${selectedFiles.length} asset${selectedFiles.length === 1 ? "" : "s"} were uploaded to private storage. Their type was detected from each file.`,
        );
        setUploadOpen(false);
      } catch (cause) {
        const failure = cause as { message?: string };
        setError(
          failure.message ||
            "One or more site photos could not be uploaded. Retry will continue with the remaining files.",
        );
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
      return;
    }
    if (
      scopedAssetMode && compactPhotoMode && selected
    ) {
      if (inFlight.current) return;
      inFlight.current = true;
      setBusy(true);
      setError("");
      try {
        setMessage(`Uploading ${assetKindLabel(providerDocumentMediaType(selected)).toLowerCase()}…`);
        await uploadIntakePhoto(selected);
        setSelected(null);
        setSelectedFiles([]);
        await load();
        await onChanged?.();
        setMessage(`${assetKindLabel(providerDocumentMediaType(selected))} was uploaded to private storage.`);
        setUploadOpen(false);
      } catch (cause) {
        setError(
          (cause as { message?: string }).message ||
            "The asset upload could not be completed.",
        );
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
      return;
    }
    if (!selected || inFlight.current) return;
    const validation = autoDetectUploadMode
      ? providerDocumentMediaType(selected).startsWith("image/")
        ? workIntakePhotoFileError(selected)
        : workIntakeDocumentFileError(selected)
      : scopedAssetMode && activeIntakeType === "photos"
        ? workIntakePhotoFileError(selected)
        : scopedAssetMode && activeIntakeType === "documents"
          ? workIntakeDocumentFileError(selected)
          : providerDocumentFileError(selected);
    if (validation) {
      setError(validation);
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const checksum =
        pending?.file === selected
          ? pending.checksum
          : await sha256Hex(selected);
      let target = pending?.file === selected ? pending : null;
      if (
        !target ||
        new Date(target.transfer.expires_at).getTime() <= Date.now()
      ) {
        const requestKey = crypto.randomUUID();
        setMessage("Preparing an authorization-scoped private upload…");
        if (scopedAssetMode && !targetId) {
          setError("This record is not available for document upload yet.");
          return;
        }
        const created =
          scope === "business" && replaceDocument
            ? await operationsData.createPlatformBusinessDocumentVersion(
                providerId,
                replaceDocument.id,
                {
                  filename: selected.name,
                  media_type: providerDocumentMediaType(selected),
                  size_bytes: selected.size,
                  checksum,
                  expected_revision: replaceDocument.attributes.revision,
                },
                requestKey,
              )
            : scope === "business"
              ? await operationsData.createPlatformBusinessDocument(
                  providerId,
                  {
                    filename: selected.name,
                    media_type: providerDocumentMediaType(selected),
                    size_bytes: selected.size,
                    checksum,
                    classification:
                      classification === "OTHER"
                        ? otherClassification.trim()
                        : classification,
                    visibility: "internal",
                  },
                  requestKey,
                )
              : scope === "intake"
                ? await operationsData.createProviderDocument(
                    providerId,
                    {
                      filename: selected.name,
                      media_type: providerDocumentMediaType(selected),
                      size_bytes: selected.size,
                      checksum,
                      classification:
                        activeIntakeType === "documents"
                          ? "WORK_INTAKE_DOCUMENT"
                          : "WORK_INTAKE_PHOTO",
                      owner: { type: "PROVIDER_WORK_INTAKE", id: targetId },
                      source: { type: "PROVIDER_WORK_INTAKE", id: targetId },
                      visibility: "internal",
                    },
                    requestKey,
                  )
                : scope === "lead"
                  ? await operationsData.createMarketingLeadDocument(
                      providerId,
                      {
                        filename: selected.name,
                        media_type: providerDocumentMediaType(selected),
                        size_bytes: selected.size,
                        checksum,
                        classification:
                          classification === "OTHER"
                            ? otherClassification.trim()
                            : classification,
                        owner: {
                          type: documentTargetKind || "MARKETING_LEAD",
                          id: targetId,
                        },
                        source: {
                          type: documentTargetKind || "MARKETING_LEAD",
                          id: targetId,
                        },
                        visibility: "internal",
                      },
                      requestKey,
                    )
                  : scope === "journey"
                    ? await operationsData.createProviderDocument(
                        providerId,
                        {
                          filename: selected.name,
                          media_type: providerDocumentMediaType(selected),
                          size_bytes: selected.size,
                          checksum,
                          classification:
                            classification === "OTHER"
                              ? otherClassification.trim()
                              : classification,
                          owner: {
                            type: documentTargetKind || "PROVIDER_WORK_INTAKE",
                            id: targetId,
                          },
                          source: {
                            type: documentTargetKind || "PROVIDER_WORK_INTAKE",
                            id: targetId,
                          },
                          visibility: "internal",
                        },
                        requestKey,
                      )
                    : await (
                      scope === "provider"
                        ? operationsData.createProviderDocument
                        : operationsData.createPlatformDocument
                    )(
                      providerId,
                      {
                        filename: selected.name,
                        media_type: providerDocumentMediaType(selected),
                        size_bytes: selected.size,
                        checksum,
                        classification:
                          classification === "OTHER"
                            ? otherClassification.trim()
                            : classification,
                        owner: { type: "SERVICE_PROVIDER", id: providerId },
                        source: { type: "SERVICE_PROVIDER", id: providerId },
                        visibility: "internal",
                      },
                      requestKey,
                    );
        target = {
          file: selected,
          checksum,
          requestKey,
          documentId: created.document.id,
          versionId: created.version.id,
          transfer: created.transfer,
          uploaded: false,
        };
        setPending(target);
      }
      if (!target.uploaded) {
        setMessage("Uploading to private storage…");
        const response = await fetch(target.transfer.url, {
          method: target.transfer.method,
          headers: target.transfer.headers,
          body: selected,
          mode: "cors",
          credentials: "omit",
        });
        if (!response.ok) throw uploadFailure(response);
        target = { ...target, uploaded: true };
        setPending(target);
      }
      setMessage(
        "Verifying checksum, size, media type, and exact document version…",
      );
      if (scope === "business")
        await operationsData.finalizePlatformBusinessDocument(
          providerId,
          target.documentId,
          { version_id: target.versionId, checksum, size_bytes: selected.size },
          `${target.requestKey}-finalize`,
        );
      else if (
        scope === "provider" ||
        scope === "intake" ||
        scope === "lead" ||
        scope === "journey"
      )
        await operationsData.finalizeProviderDocument(
          providerId,
          target.documentId,
          { version_id: target.versionId, checksum, size_bytes: selected.size },
          `${target.requestKey}-finalize`,
        );
      else
        await operationsData.finalizePlatformDocument(
          providerId,
          target.documentId,
          { version_id: target.versionId, checksum, size_bytes: selected.size },
          `${target.requestKey}-finalize`,
        );
      setSelected(null);
      setSelectedFiles([]);
      setPending(null);
      await load();
      await onChanged?.();
      setMessage(
        "Document finalized in private storage. Malware scanning is disabled by platform policy; this file is explicitly recorded as not scanned.",
      );
      if (compactIntake) setUploadOpen(false);
    } catch (cause) {
      const failure = cause as { message?: string; name?: string };
      setMessage("");
      setError(
        failure.name === "TypeError" && failure.message === "Failed to fetch"
          ? "The browser could not reach private object storage. Check the private storage endpoint and CORS policy for this Operations origin."
          : failure.message ||
              "The private document upload could not be completed. Retry will preserve the current upload stage when possible.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const compactPhotoMode =
    compactIntake && scopedAssetMode;
  const autoDetectUploadMode = compactPhotoMode && uploadOnly;
  const intakeLabel =
    activeIntakeType === "documents"
      ? "documents"
      : scope === "journey"
        ? "photos"
        : "site photos";
  const documentOwnerLabel =
    scope === "business"
      ? "Business"
      : scope === "intake"
        ? intakeLabel
        : scope === "lead"
          ? "Lead"
          : scope === "journey"
            ? "Workflow record"
          : "provider";
  const documentSectionTitle =
    scope === "lead"
      ? "Lead assets"
      : scope === "journey"
        ? "Workflow assets"
        : "Provider documents";
  const compactRecordLabel =
    scope === "lead"
      ? "this Lead"
      : scope === "journey"
        ? "this workflow record"
        : "this Work Intake";
  const intakeMediaTypes = !scopedAssetMode
    ? PROVIDER_DOCUMENT_MEDIA_TYPES
    : activeIntakeType === "documents"
      ? PROVIDER_DOCUMENT_MEDIA_TYPES.filter(
          (mediaType) => !mediaType.startsWith("image/"),
        )
      : WORK_INTAKE_PHOTO_MEDIA_TYPES;
  const intakeAccept = autoDetectUploadMode
    ? `${WORK_INTAKE_PHOTO_MEDIA_TYPES.join(",")},${PROVIDER_DOCUMENT_MEDIA_TYPES.filter((mediaType) => !mediaType.startsWith("image/")).join(",")},.png,.jpg,.jpeg,.webp,.pdf,.doc,.docx,.xls,.xlsx`
    : activeIntakeType === "documents"
      ? `${intakeMediaTypes.join(",")},.pdf,.doc,.docx,.xls,.xlsx`
      : `${intakeMediaTypes.join(",")},.png,.jpg,.jpeg,.webp`;
  const maxUploadLabel = activeIntakeType === "documents" ? "2 MiB" : "25 MiB";
  return (
    <>
      {activityEvidence && !uploadOnly ? (
        <section className="provider-intake-photo-summary workflow-follow-up-evidence-list">
          <div className="provider-intake-photo-heading">
            <span className="provider-intake-photo-icon">
              <SvgIcon name="clipboard" size={20} />
            </span>
            <div>
              <span className="provider-work-intake-eyebrow">
                Activity assets
              </span>
              <h3>Attached photos and documents</h3>
              <p>Assets already attached to this history item.</p>
            </div>
          </div>
          {loading ? (
            <p className="platform-muted">Loading attached assets…</p>
          ) : documents.length ? (
            <div className="provider-intake-photo-grid">
              {documents.map((document) => (
                <figure key={document.id}>
                  <button
                    type="button"
                    onClick={() => void openDocument(document)}
                    aria-label={`Open preview for ${document.attributes.filename}`}
                    className={`provider-intake-photo-frame ${assetKindClass(document.attributes.media_type)}`}
                  >
                    {galleryUrls[document.id] &&
                    document.attributes.media_type.startsWith("image/") ? (
                      <img
                        src={galleryUrls[document.id]}
                        alt={document.attributes.filename}
                      />
                    ) : (
                      <span>{assetKind(document.attributes.media_type)}</span>
                    )}
                  </button>
                  <figcaption>
                    <strong title={document.attributes.filename}>
                      {document.attributes.filename}
                    </strong>
                    <small>
                      {humanFileSize(document.attributes.size_bytes)}
                    </small>
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <p className="platform-empty-inline">
              No assets have been attached to this history item.
            </p>
          )}
        </section>
      ) : compactPhotoMode && uploadOnly ? (
        <section className="provider-intake-photo-summary workflow-follow-up-upload-only">
          <div className="workflow-follow-up-inline-upload">
            <header>
              <div>
                <span className="provider-work-intake-eyebrow">
                  Attach assets
                </span>
                <h3>Upload photos or documents</h3>
                <p>
                  Choose photos, PDF, Word, or Excel files; type and size are
                  detected and checked automatically before upload (images up
                  to 25 MiB, documents up to 2 MiB).
                </p>
              </div>
            </header>
            <UploadBody />
          </div>
        </section>
      ) : compactPhotoMode && assetCenter ? (
        <section className="provider-intake-photo-summary work-intake-asset-summary">
          <div className="work-intake-asset-summary-header">
            <div className="provider-intake-photo-heading">
              <span className="provider-intake-photo-icon">
                <SvgIcon name="grid" size={20} />
              </span>
              <div>
                <span className="provider-work-intake-eyebrow">
                  {scope === "lead"
                    ? "Lead assets"
                    : scope === "journey"
                      ? "Workflow assets"
                      : "Site assets"}
                </span>
                <h3>Assets &amp; documents</h3>
                <p>
                  {loading
                    ? "Loading attached assets…"
                    : `${assetCounts.images} images · ${assetCounts.documents} documents attached to ${compactRecordLabel}. ${scope === "journey" && canUpload ? "Use Add assets above to attach more." : canUpload ? `Update assets while ${compactRecordLabel} is open.` : "Assets are view-only for this session."}`}
                </p>
              </div>
            </div>
            <div className="provider-intake-photo-actions">
              {canUpload && scope !== "journey" && (
                <Button type="button" onClick={() => setUploadOpen(true)}>
                  <SvgIcon name="upload" size={15} /> Update assets
                </Button>
              )}
            </div>
          </div>
          <div className="work-intake-asset-layout">
            <AssetTypeNav
              assetTab={assetTab}
              counts={assetCounts}
              onSelect={selectAssetTab}
            />
            <div className="work-intake-asset-content">
              {loading || galleryLoading ? (
                <p className="platform-muted">
                  Loading the private {intakeLabel} gallery…
                </p>
              ) : documents.length ? (
                <div className="provider-intake-photo-grid work-intake-asset-inline-grid">
                  {documents.map((document) => (
                    <figure
                      className="provider-intake-asset-card"
                      key={document.id}
                    >
                      <button
                        type="button"
                        onClick={() => void openDocument(document)}
                        aria-label={
                          "Open preview for " + document.attributes.filename
                        }
                        className={
                          "provider-intake-photo-frame " +
                          (activeIntakeType === "documents"
                            ? "document-frame "
                            : "") +
                          assetKindClass(document.attributes.media_type)
                        }
                      >
                        {galleryUrls[document.id] ? (
                          document.attributes.media_type.startsWith(
                            "image/",
                          ) ? (
                            <img
                              src={galleryUrls[document.id]}
                              alt={document.attributes.filename}
                            />
                          ) : (
                            <div className="provider-document-office-tile">
                              <SvgIcon name="clipboard" size={28} />
                              <strong>
                                {assetKind(document.attributes.media_type)}
                              </strong>
                              <small>Protected preview</small>
                            </div>
                          )
                        ) : (
                          <span>Preview unavailable</span>
                        )}
                        <span
                          className={
                            "provider-intake-asset-badge " +
                            assetKindClass(document.attributes.media_type)
                          }
                        >
                          {assetKind(document.attributes.media_type)}
                        </span>
                      </button>
                      <figcaption>
                        <div className="provider-intake-asset-caption">
                          <strong title={document.attributes.filename}>
                            {document.attributes.filename}
                          </strong>
                          <span
                            className={
                              "provider-intake-asset-type " +
                              assetKindClass(document.attributes.media_type)
                            }
                          >
                            {assetKindLabel(document.attributes.media_type)}
                          </span>
                        </div>
                        <small>
                          {humanFileSize(document.attributes.size_bytes)}
                        </small>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              ) : (
                <p className="platform-empty-inline">
                  No {intakeLabel} have been uploaded.
                </p>
              )}
            </div>
          </div>
        </section>
      ) : compactPhotoMode ? (
        <section
          className={`provider-intake-photo-summary${scope === "intake" ? " work-intake-asset-summary" : ""}`}
        >
          <div className="provider-intake-photo-heading">
            <span className="provider-intake-photo-icon">
              <SvgIcon
                name={activeIntakeType === "documents" ? "clipboard" : "grid"}
                size={20}
              />
            </span>
            <div>
              <span className="provider-work-intake-eyebrow">
                {scope === "lead"
                  ? "Lead assets"
                  : scope === "journey"
                    ? "Workflow assets"
                    : "Site assets"}
              </span>
              <h3>
                {scope === "lead"
                  ? activeIntakeType === "documents"
                    ? "Lead documents"
                    : "Lead photos"
                  : scope === "journey"
                    ? activeIntakeType === "documents"
                      ? "Workflow documents"
                      : "Workflow photos"
                    : activeIntakeType === "documents"
                      ? "Site documents"
                      : "Site photos"}
              </h3>
              <p>
                {documents.length
                  ? `${documents.length} private ${intakeLabel} attached to ${compactRecordLabel}.`
                  : activeIntakeType === "documents"
                    ? `Attach drawings, quotations, reports, or other supporting files to ${compactRecordLabel}.`
                    : `Attach multiple photos to document the site condition and work request for ${compactRecordLabel}.`}
              </p>
            </div>
          </div>
          <div className="provider-intake-photo-actions">
            {canUpload && (
              <Button type="button" onClick={() => setUploadOpen(true)}>
                <SvgIcon name="upload" size={15} /> Upload {intakeLabel}
              </Button>
            )}
            <Button
              type="button"
              variant="secondary"
              disabled={!documents.length}
              onClick={() => setGalleryOpen(true)}
            >
              <SvgIcon name="eye" size={15} /> View {intakeLabel}
              {documents.length ? ` (${documents.length})` : ""}
            </Button>
          </div>
        </section>
      ) : canUpload ? (
        <>
          {showUploadHeading ? (
            <DetailSection
              title={
                replaceDocument
                  ? `Replace ${replaceDocument.attributes.filename}`
                  : scope === "intake"
                    ? `Upload ${intakeLabel}`
                    : "Upload document"
              }
              description={
                scope === "business"
                  ? "Files remain private and Business-owned. Replacement creates a new immutable version while preserving prior versions and audit history."
                  : scope === "intake" || scope === "journey"
                    ? "Files remain private, provider-scoped, and attached to this Work Intake as immutable assets."
                    : "Files remain private and provider-scoped. New files are versioned and remain subject to asset controls."
              }
            >
              <UploadBody />
            </DetailSection>
          ) : (
            <UploadBody />
          )}
        </>
      ) : (
        <StatePanel title="Document upload is restricted">
          <span>
            Your authenticated platform grant permits document metadata access
            but not provider document uploads.
          </span>
        </StatePanel>
      )}
      {compactPhotoMode && uploadOpen && !uploadOnly && (
        <OperationsDialog
          className={
            scope === "intake" ? "work-intake-asset-dialog" : undefined
          }
          title={
            uploadOnly
              ? "Add assets"
              : assetCenter
                ? "Update assets"
                : `Upload ${scope === "lead" ? "Lead " : ""}${intakeLabel}`
          }
          busy={busy}
          onClose={() => setUploadOpen(false)}
        >
          <div className="provider-intake-photo-dialog">
            {assetCenter && uploadOnly ? (
              <div
                className="provider-intake-upload-type-grid"
                aria-label="Attachment type"
              >
                <button
                  type="button"
                  className={assetTab === "images" ? "is-active" : ""}
                  onClick={() => selectUploadType("images")}
                >
                  <SvgIcon name="grid" size={20} />
                  <strong>Photos</strong>
                  <span>PNG, JPEG, or WebP · up to 25 MiB</span>
                </button>
                <button
                  type="button"
                  className={assetTab === "documents" ? "is-active" : ""}
                  onClick={() => selectUploadType("documents")}
                >
                  <SvgIcon name="clipboard" size={20} />
                  <strong>Documents</strong>
                  <span>PDF, Word, or Excel · up to 2 MiB</span>
                </button>
              </div>
            ) : (
              assetCenter && (
                <AssetTypeNav
                  assetTab={assetTab}
                  counts={assetCounts}
                  onSelect={selectAssetTab}
                />
              )
            )}
            <p>
              {activeIntakeType === "documents"
                ? `Choose one or more PDF, Word, or Excel files. Each remains private and is attached to ${compactRecordLabel}.`
                : `Choose one or more PNG, JPEG, or WebP photos. Each remains private and is attached to ${compactRecordLabel} as an asset.`}
            </p>
            <UploadBody />
          </div>
        </OperationsDialog>
      )}
      {compactPhotoMode && galleryOpen && (
        <OperationsDialog
          className={
            scope === "intake" ? "work-intake-asset-dialog" : undefined
          }
          title="View assets"
          onClose={() => setGalleryOpen(false)}
        >
          <div
            className={`provider-intake-photo-gallery${scope === "intake" ? " work-intake-asset-gallery" : ""}`}
          >
            {assetCenter && (
              <AssetTypeNav
                assetTab={assetTab}
                counts={assetCounts}
                onSelect={selectAssetTab}
              />
            )}
            <p className="provider-intake-gallery-note">
              Select any asset to open its protected preview. Images and PDFs
              render in place; Word and Excel files show a safe file preview
              card with explicit download.
            </p>
            {galleryLoading ? (
              <p className="platform-muted">
                Preparing the private {intakeLabel} gallery…
              </p>
            ) : documents.length ? (
              <div className="provider-intake-photo-grid">
                {documents.map((document) => (
                  <figure
                    className="provider-intake-asset-card"
                    key={document.id}
                  >
                    <div
                      className={`provider-intake-photo-frame ${activeIntakeType === "documents" ? "document-frame" : ""} ${assetKindClass(document.attributes.media_type)}`}
                    >
                      <span
                        className={`provider-intake-asset-badge ${assetKindClass(document.attributes.media_type)}`}
                      >
                        {assetKind(document.attributes.media_type)}
                      </span>
                      {galleryUrls[document.id] ? (
                        document.attributes.media_type.startsWith("image/") ? (
                          <img
                            src={galleryUrls[document.id]}
                            alt={document.attributes.filename}
                          />
                        ) : document.attributes.media_type ===
                          "application/pdf" ? (
                          <iframe
                            src={galleryUrls[document.id]}
                            title={document.attributes.filename}
                          />
                        ) : (
                          <div className="provider-document-office-tile">
                            <SvgIcon name="clipboard" size={28} />
                            <strong>
                              {officeLabel(document.attributes.media_type)}
                            </strong>
                            <small>Protected preview</small>
                          </div>
                        )
                      ) : (
                        <span>Preview unavailable</span>
                      )}
                    </div>
                    <figcaption>
                      <div className="provider-intake-asset-caption">
                        <strong title={document.attributes.filename}>
                          {document.attributes.filename}
                        </strong>
                        <span
                          className={`provider-intake-asset-type ${assetKindClass(document.attributes.media_type)}`}
                        >
                          {assetKindLabel(document.attributes.media_type)}
                        </span>
                      </div>
                      <small>
                        {humanFileSize(document.attributes.size_bytes)} ·{" "}
                        {document.attributes.status.replaceAll("_", " ")}
                      </small>
                      <Button
                        type="button"
                        variant="quiet"
                        onClick={() => void openDocument(document)}
                      >
                        Open preview
                      </Button>
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : (
              <p className="platform-empty-inline">
                No {intakeLabel} have been uploaded.
              </p>
            )}
          </div>
        </OperationsDialog>
      )}
      {preview && (
        <OperationsDialog
          className={
            compactPhotoMode && scope === "intake"
              ? "work-intake-asset-dialog"
              : undefined
          }
          title={`Preview · ${assetKindLabel(preview.document.attributes.media_type)}`}
          onClose={() => {
            setPreview(null);
            setPreviewIndex(null);
          }}
        >
          <div
            className={`provider-document-preview${compactPhotoMode && scope === "intake" ? " work-intake-asset-preview" : ""}`}
          >
            <div className="provider-document-preview-meta">
              <span
                className={`provider-intake-asset-type ${assetKindClass(preview.document.attributes.media_type)}`}
              >
                {assetKind(preview.document.attributes.media_type)}
              </span>
              <div>
                <strong title={preview.document.attributes.filename}>
                  {preview.document.attributes.filename}
                </strong>
                <small>
                  {assetKindLabel(preview.document.attributes.media_type)} ·{" "}
                  {humanFileSize(preview.document.attributes.size_bytes)}
                </small>
              </div>
            </div>
            <div className="provider-document-preview-frame">
              {previewSurface(preview.document, preview.url)}
            </div>
            <div className="provider-document-preview-toolbar">
              <Button
                type="button"
                variant="secondary"
                onClick={() => movePreview(-1)}
                disabled={
                  documents.filter(
                    (document) => document.attributes.current_version_id,
                  ).length < 2
                }
              >
                ← Previous
              </Button>
              <span>
                {(() => {
                  const previewable = documents.filter(
                    (document) => document.attributes.current_version_id,
                  );
                  const position = previewable.findIndex(
                    (document) => document.id === preview.document.id,
                  );
                  return `${position >= 0 ? position + 1 : 1} of ${previewable.length}`;
                })()}
              </span>
              <Button
                type="button"
                variant="secondary"
                onClick={() => movePreview(1)}
                disabled={
                  documents.filter(
                    (document) => document.attributes.current_version_id,
                  ).length < 2
                }
              >
                Next →
              </Button>
            </div>
          </div>
        </OperationsDialog>
      )}
      {!compactPhotoMode && showDocumentList && (
        <DetailSection
          title={documentSectionTitle}
          description="Only authorized metadata is shown. Storage keys and unrestricted URLs are never exposed."
        >
          {loading ? (
            <p className="platform-muted">
              Loading {documentOwnerLabel} documents…
            </p>
          ) : documents.length ? (
            <div className="platform-provider-table-wrap">
              <table className="platform-provider-table">
                <caption className="sr-only">
                  Private {documentOwnerLabel} documents
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Document</th>
                    <th scope="col">Classification</th>
                    <th scope="col">Size</th>
                    <th scope="col">Version</th>
                    <th scope="col">Lifecycle</th>
                    <th scope="col">Scan state</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((document) => (
                    <tr key={document.id}>
                      <td>
                        <strong>{document.attributes.filename}</strong>
                        <small>{document.attributes.media_type}</small>
                      </td>
                      <td>
                        {document.attributes.classification.replaceAll(
                          "_",
                          " ",
                        )}
                      </td>
                      <td>{humanFileSize(document.attributes.size_bytes)}</td>
                      <td>
                        {document.attributes.current_version || "Pending"}
                      </td>
                      <td>
                        <Status>
                          {document.attributes.status.replaceAll("_", " ")}
                        </Status>
                      </td>
                      <td>
                        <Status>
                          {document.attributes.scan_state.replaceAll("_", " ")}
                        </Status>
                        {document.attributes.scan_recorded_at && (
                          <small>
                            {formatIndiaDateTime(
                              document.attributes.scan_recorded_at,
                            )}
                          </small>
                        )}
                      </td>
                      <td>
                        <ProviderActionMenu
                          label={`Actions for ${document.attributes.filename}`}
                          actions={[
                            {
                              id: "preview",
                              label: "Preview document",
                              disabled: !document.attributes.current_version_id,
                              onSelect: () => void openDocument(document),
                            },
                            {
                              id: "download",
                              label: "Download document",
                              disabled: !document.attributes.current_version_id,
                              onSelect: () => downloadDocument(document),
                            },
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="platform-empty-inline">
              No {documentOwnerLabel} documents have been uploaded.
            </p>
          )}
          <p className="platform-form-note">
            Preview opens inside this application. Downloads use a fresh,
            authorization-scoped transfer.
          </p>
        </DetailSection>
      )}
    </>
  );
  function UploadBody() {
    return (
      <div className="provider-document-upload" aria-busy={busy}>
        {busy && (
          <div
            className="provider-document-upload-progress"
            role="status"
            aria-live="polite"
          >
            <span
              className="provider-document-upload-spinner"
              aria-hidden="true"
            />
            <div>
              <strong>Uploading assets</strong>
              <small>
                {message || "Sending the selected assets to private storage…"}
              </small>
            </div>
          </div>
        )}
        <input
          ref={input}
          className="logo-file-input"
          type="file"
          multiple={scopedAssetMode}
          accept={intakeAccept}
          onChange={(event) => {
            chooseFiles(Array.from(event.target.files || []));
            event.currentTarget.value = "";
          }}
          disabled={busy}
        />
        {!autoDetectUploadMode && (
          <p className="provider-document-upload-policy" role="note">
            <strong>
              {activeIntakeType === "documents"
                ? "Documents: PDF, Word, or Excel · maximum 2 MiB each."
                : "Images: PNG, JPEG, or WebP · maximum 25 MiB each."}
            </strong>
            <span>
              Files are checked before upload and rejected if the type or size
              is not allowed.
            </span>
          </p>
        )}
        {!compactPhotoMode && scope !== "intake" && scope !== "journey" && (
          <label>
            Document type / scope
            <select
              required
              value={classification}
              onChange={(event) => {
                setClassification(event.target.value);
                setOtherClassification("");
              }}
              disabled={busy}
            >
              {scope === "business" ? (
                <>
                  <option value="BUSINESS_VERIFICATION">
                    Corporate / legal identity
                  </option>
                  <option value="BUSINESS_LOGO">Business logo</option>
                  <option value="GST_CERTIFICATE">GST registration</option>
                  <option value="BUSINESS_LICENCE">Business licence</option>
                  <option value="REGISTRATION_EVIDENCE">
                    Company / registration evidence
                  </option>
                  <option value="BRAND_TRADEMARK">Brand / trademark</option>
                  <option value="GENERAL_SUPPORTING_EVIDENCE">
                    Other supporting evidence
                  </option>
                </>
              ) : (
                <>
                  <option value="BUSINESS_VERIFICATION">
                    Business verification
                  </option>
                  <option value="GST_CERTIFICATE">GST certificate</option>
                  <option value="BUSINESS_LICENCE">Business licence</option>
                  <option value="REGISTRATION_EVIDENCE">
                    Registration evidence
                  </option>
                  <option value="BRAND_TRADEMARK">Brand or trademark</option>
                  <option value="GENERAL_SUPPORTING_EVIDENCE">
                    General supporting evidence
                  </option>
                </>
              )}
              <option value="OTHER">Other</option>
            </select>
          </label>
        )}
        {classification === "OTHER" &&
          scope !== "intake" &&
          scope !== "journey" &&
          !compactPhotoMode && (
            <label>
              Specify document type
              <input
                required
                value={otherClassification}
                onChange={(event) => setOtherClassification(event.target.value)}
                disabled={busy}
                maxLength={120}
              />
            </label>
          )}
        <button
          className="provider-document-dropzone"
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
        >
          <span className="platform-summary-icon">
            <SvgIcon name="upload" size={20} />
          </span>
          <strong>
            {selected
              ? scopedAssetMode &&
                selectedFiles.length > 1
                ? `${selectedFiles.length} ${autoDetectUploadMode ? "assets" : intakeLabel} selected`
                : selected.name
              : scopedAssetMode
                ? autoDetectUploadMode
                  ? "Choose photos or documents"
                  : `Choose ${intakeLabel}`
                : "Choose a private document"}
          </strong>
          <span>
            {selected
              ? scopedAssetMode &&
                selectedFiles.length > 1
                ? `Multiple ${intakeLabel} ready to upload`
                : `${selected.type} · ${humanFileSize(selected.size)}`
              : scopedAssetMode
                ? autoDetectUploadMode
                  ? "Select photos, PDF, Word, or Excel files · type detected automatically"
                  : `Select multiple ${activeIntakeType === "documents" ? "PDF, Word, or Excel files" : "PNG, JPEG, or WebP files"} · maximum ${maxUploadLabel} each`
                : "PDF, Word, Excel, PNG, JPEG, or WebP · maximum 2 MiB"}
          </span>
        </button>
        {selectedFiles.length > 0 && (
          <div className="provider-intake-upload-selection">
            <div>
              <strong>
                {selectedFiles.length} file
                {selectedFiles.length === 1 ? "" : "s"} ready
              </strong>
              <small>
                Review the selection before sending it to private storage.
              </small>
            </div>
            <ul>
              {selectedFiles.slice(0, 4).map((file) => (
                <li key={`${file.name}-${file.size}`}>
                  <span
                    className={`provider-intake-asset-type ${assetKindClass(file.type)}`}
                  >
                    {assetKind(file.type)}
                  </span>
                  <span title={file.name}>{file.name}</span>
                  <small>{humanFileSize(file.size)}</small>
                </li>
              ))}
            </ul>
            {selectedFiles.length > 4 && (
              <small>+ {selectedFiles.length - 4} more selected files</small>
            )}
          </div>
        )}
        {!compactPhotoMode && (
          <dl className="platform-definition-list provider-document-policy">
            <dt>Classification</dt>
            <dd>
              {classification === "OTHER"
                ? otherClassification || "Specify document type"
                : classification.replaceAll("_", " ")}
            </dd>
            <dt>Visibility</dt>
            <dd>Internal</dd>
            <dt>Scan state</dt>
            <dd>Shown from the authoritative document version</dd>
          </dl>
        )}
        <div className="platform-form-actions">
          <Button
            type="button"
            variant="secondary"
            onClick={() => input.current?.click()}
            disabled={busy}
          >
            {selected
              ? scopedAssetMode
                ? autoDetectUploadMode
                  ? "Choose more assets"
                  : `Choose more ${intakeLabel}`
                : "Choose another file"
              : "Browse files"}
          </Button>
          <Button
            type="button"
            onClick={() => void upload()}
            disabled={
              !selected ||
              busy ||
              (classification === "OTHER" && !otherClassification.trim())
            }
            busy={busy}
          >
            {scopedAssetMode
              ? autoDetectUploadMode
                ? "Upload selected assets"
                : `Upload ${intakeLabel}`
              : pending?.uploaded
                ? "Retry finalization"
                : "Upload document"}
          </Button>
        </div>
        {message && (
          <p className="platform-form-note" role="status">
            {message}
          </p>
        )}
        {error && (
          <StatePanel title="Document action needs attention">
            <span>{error}</span>
            {selected && (
              <Button
                variant="secondary"
                onClick={() => void upload()}
                disabled={busy}
              >
                {pending?.uploaded ? "Retry finalization" : "Retry upload"}
              </Button>
            )}
          </StatePanel>
        )}
      </div>
    );
  }
}

export { PROVIDER_DOCUMENT_MAX_BYTES };
