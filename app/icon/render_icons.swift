// © 2026 Eric G. Suchanek, PhD -- Flux-Frontiers -- SPDX-License-Identifier: LicenseRef-Flux-Frontiers-Proprietary
// The Knowledge Press. Not redistributable; see app/LICENSE.
//
// Renders the icon PNGs that are not the app icon itself: that one is the Icon
// Composer document AppIcon.icon, which Xcode compiles. Run from the repo root
// with `make icons`. The SVGs are the source of truth; the PNGs are committed
// so a build never needs this script.
//
//   press-seal.svg       -> the 1024 px master, opaque, written byte-identical
//                           to its splash copy, plus the proof strip
//   web/public/favicon.svg -> the web forest's PNG favicon, 32 px with alpha,
//                           for browsers that skip an SVG icon
//   press-seal.svg       -> also the 180 px apple-touch-icon, opaque, which
//                           iOS rounds itself for a home-screen bookmark

import AppKit
import UniformTypeIdentifiers

let master = [
    "app/icon/AppIcon-1024.png",
    "app/GutenbergKGKit/Sources/KnowledgePressUI/Resources/AppIcon-1024.png",
]
let paper = NSColor(srgbRed: 0xf4 / 255.0, green: 0xf0 / 255.0, blue: 0xdc / 255.0, alpha: 1)

func load(_ path: String) -> NSImage {
    guard let img = NSImage(contentsOfFile: path) else { fatalError("cannot load \(path)") }
    return img
}

/// Draws into a sRGB bitmap and returns it as PNG data.
///
/// :param w: width in pixels
/// :param h: height in pixels
/// :param alpha: keep an alpha channel; without one the PNG is plain RGB
/// :param body: AppKit drawing, in a context the size of the bitmap
func png(_ w: Int, _ h: Int, alpha: Bool, _ body: () -> Void) -> Data {
    let info = alpha ? CGImageAlphaInfo.premultipliedLast : CGImageAlphaInfo.noneSkipLast
    let cg = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: 0,
                       space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: info.rawValue)!
    cg.interpolationQuality = .high
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(cgContext: cg, flipped: false)
    body()
    NSGraphicsContext.restoreGraphicsState()
    let data = NSMutableData()
    let dest = CGImageDestinationCreateWithData(data, UTType.png.identifier as CFString, 1, nil)!
    CGImageDestinationAddImage(dest, cg.makeImage()!, nil)
    guard CGImageDestinationFinalize(dest) else { fatalError("cannot encode PNG") }
    return data as Data
}

func write(_ data: Data, _ path: String) {
    try! data.write(to: URL(fileURLWithPath: path))
    print("wrote \(path)")
}

let seal = load("app/icon/press-seal.svg")
let full = png(1024, 1024, alpha: false) { seal.draw(in: NSRect(x: 0, y: 0, width: 1024, height: 1024)) }
master.forEach { write(full, $0) }

// The master at 96, 48, 32 and 16 px on the brand's paper, left to right, each
// clipped to an app icon's rounded square so its edge shows against the light.
write(png(284, 128, alpha: false) {
    paper.setFill()
    NSRect(x: 0, y: 0, width: 284, height: 128).fill()
    var x: CGFloat = 16
    for s: CGFloat in [96, 48, 32, 16] {
        let r = NSRect(x: x, y: (128 - s) / 2, width: s, height: s)
        NSGraphicsContext.saveGraphicsState()
        NSBezierPath(roundedRect: r, xRadius: s * 0.2237, yRadius: s * 0.2237).addClip()
        seal.draw(in: r)
        NSGraphicsContext.restoreGraphicsState()
        x += s + 24
    }
}, "app/icon/AppIcon-proof.png")

let favicon = load("web/public/favicon.svg")
write(png(32, 32, alpha: true) { favicon.draw(in: NSRect(x: 0, y: 0, width: 32, height: 32)) },
      "web/public/favicon-32.png")
write(png(180, 180, alpha: false) { seal.draw(in: NSRect(x: 0, y: 0, width: 180, height: 180)) },
      "web/public/apple-touch-icon.png")
