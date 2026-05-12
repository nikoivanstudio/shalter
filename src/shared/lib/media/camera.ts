export type CameraFacingMode = "user" | "environment"

type CameraSwitchOptions = {
  nextFacing: CameraFacingMode
  currentStream: MediaStream
  width?: number
  height?: number
  preserveAudio?: boolean
  enabled?: boolean
  stopCurrentTrack?: boolean
}

type ReplacementCameraStreamParams = {
  nextFacing: CameraFacingMode
  currentDeviceId?: string | null
  width?: number
  height?: number
}

type CameraSwitchResult = {
  stream: MediaStream
  videoTrack: MediaStreamTrack
  facing: CameraFacingMode
}

type AttemptMode =
  | "device-exact"
  | "device-ideal"
  | "facing-environment-exact"
  | "facing-user-exact"
  | "facing-environment-ideal"
  | "facing-user-ideal"
  | "generic"

function buildSizeConstraints(params: { width?: number; height?: number }) {
  return params.width || params.height
    ? {
        ...(params.width ? { width: { ideal: params.width } } : {}),
        ...(params.height ? { height: { ideal: params.height } } : {}),
      }
    : {}
}

function buildVideoConstraints(
  params: ReplacementCameraStreamParams,
  mode: AttemptMode,
  targetDeviceId: string | null
): MediaTrackConstraints {
  const sizeConstraints = buildSizeConstraints(params)

  if (mode === "device-exact" && targetDeviceId) {
    return {
      deviceId: { exact: targetDeviceId },
      ...sizeConstraints,
    }
  }

  if (mode === "device-ideal" && targetDeviceId) {
    return {
      deviceId: { ideal: targetDeviceId },
      ...sizeConstraints,
    }
  }

  if (mode === "facing-environment-exact") {
    return {
      facingMode: { exact: "environment" },
      ...sizeConstraints,
    }
  }

  if (mode === "facing-user-exact") {
    return {
      facingMode: { exact: "user" },
      ...sizeConstraints,
    }
  }

  if (mode === "facing-environment-ideal") {
    return {
      facingMode: { ideal: "environment" },
      ...sizeConstraints,
    }
  }

  if (mode === "facing-user-ideal") {
    return {
      facingMode: { ideal: "user" },
      ...sizeConstraints,
    }
  }

  return sizeConstraints
}

async function getVideoInputDevices() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    return devices.filter((device) => device.kind === "videoinput")
  } catch {
    return []
  }
}

function chooseAlternativeDeviceId(devices: MediaDeviceInfo[], currentDeviceId: string | null) {
  if (devices.length <= 1) {
    return null
  }

  return devices.find((device) => device.deviceId && device.deviceId !== currentDeviceId)?.deviceId ?? null
}

function getAttemptModes(nextFacing: CameraFacingMode, targetDeviceId: string | null): AttemptMode[] {
  const preferredFacingIdeal =
    nextFacing === "environment" ? "facing-environment-ideal" : "facing-user-ideal"
  const preferredFacingExact =
    nextFacing === "environment" ? "facing-environment-exact" : "facing-user-exact"
  const fallbackFacingIdeal =
    nextFacing === "environment" ? "facing-user-ideal" : "facing-environment-ideal"

  const attempts: AttemptMode[] = []

  if (targetDeviceId) {
    attempts.push("device-exact", "device-ideal")
  }

  attempts.push(preferredFacingIdeal, preferredFacingExact, fallbackFacingIdeal, "generic")

  return attempts
}

export async function getReplacementCameraStream(
  params: ReplacementCameraStreamParams
): Promise<MediaStream> {
  const devices = await getVideoInputDevices()
  const targetDeviceId = chooseAlternativeDeviceId(devices, params.currentDeviceId ?? null)
  const attempts = getAttemptModes(params.nextFacing, targetDeviceId)

  let lastError: unknown = null

  for (const attempt of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: buildVideoConstraints(params, attempt, targetDeviceId),
      })
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error("camera")
}

export async function switchCameraInMediaStream(
  options: CameraSwitchOptions
): Promise<CameraSwitchResult> {
  const currentTrack = options.currentStream.getVideoTracks()[0] ?? null
  const currentDeviceId = currentTrack?.getSettings().deviceId ?? null
  const replacementStream = await getReplacementCameraStream({
    nextFacing: options.nextFacing,
    currentDeviceId,
    width: options.width,
    height: options.height,
  })

  const replacementTrack = replacementStream.getVideoTracks()[0] ?? null
  if (!replacementTrack) {
    for (const track of replacementStream.getTracks()) {
      track.stop()
    }
    throw new Error("camera")
  }

  const nextStreamTracks = [
    ...(options.preserveAudio === false ? [] : options.currentStream.getAudioTracks()),
    replacementTrack,
  ]

  if (currentTrack) {
    options.currentStream.removeTrack(currentTrack)
    if (options.stopCurrentTrack !== false) {
      currentTrack.stop()
    }
  }

  options.currentStream.addTrack(replacementTrack)
  replacementTrack.enabled = options.enabled ?? true

  for (const track of replacementStream.getTracks()) {
    if (track.id !== replacementTrack.id) {
      track.stop()
    }
  }

  return {
    stream: new MediaStream(nextStreamTracks),
    videoTrack: replacementTrack,
    facing: options.nextFacing,
  }
}
