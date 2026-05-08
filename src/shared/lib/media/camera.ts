type CameraFacingMode = "user" | "environment"

type GetReplacementCameraStreamParams = {
  nextFacing: CameraFacingMode
  currentDeviceId?: string | null
  width?: number
  height?: number
}

function buildVideoConstraints(
  params: GetReplacementCameraStreamParams,
  mode: "device-exact" | "facing-ideal" | "facing-exact" | "generic"
): MediaTrackConstraints {
  const sizeConstraints =
    params.width || params.height
      ? {
          ...(params.width ? { width: { ideal: params.width } } : {}),
          ...(params.height ? { height: { ideal: params.height } } : {}),
        }
      : {}

  if (mode === "device-exact" && params.currentDeviceId) {
    return {
      deviceId: { exact: params.currentDeviceId },
      ...sizeConstraints,
    }
  }

  if (mode === "facing-exact") {
    return {
      facingMode: { exact: params.nextFacing },
      ...sizeConstraints,
    }
  }

  if (mode === "facing-ideal") {
    return {
      facingMode: { ideal: params.nextFacing },
      ...sizeConstraints,
    }
  }

  return sizeConstraints
}

export async function getReplacementCameraStream(
  params: GetReplacementCameraStreamParams
): Promise<MediaStream> {
  const attempts: Array<"device-exact" | "facing-ideal" | "facing-exact" | "generic"> = [
    "facing-ideal",
    "facing-exact",
    "generic",
  ]

  if (params.currentDeviceId) {
    attempts.unshift("device-exact")
  }

  let lastError: unknown = null

  for (const attempt of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: buildVideoConstraints(params, attempt),
      })
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error("camera")
}
