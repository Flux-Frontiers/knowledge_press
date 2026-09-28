// © 2026 Eric G. Suchanek, PhD -- Flux-Frontiers -- SPDX-License-Identifier: LicenseRef-Flux-Frontiers-Proprietary
// The Knowledge Press. Not redistributable; see app/LICENSE.
//
// Renders every app icon PNG from the press-seal SVGs. Run from the repo root
// with `make icons`. The SVGs are the source of truth; the PNGs are committed
// so a build never needs this script.
//
//   press-seal.svg       -> the 1024 px master, opaque as the App Store requires,
//                           written byte-identical to its iOS and splash copies,
//                           plus the proof strip
//   press-seal-macos.svg -> the ten macOS sizes, with alpha

import AppKit
import UniformTypeIdentifiers

let master = [
    "app/icon/AppIcon-1024.png",
    "app/ios/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png",
    "app/GutenbergKGKit/Sources/KnowledgePressUI/Resources/AppIcon-1024.png",
]
let macSet = "app/macos/Assets.xcassets/AppIcon.appiconset"
let navy = NSColor(srgbRed: 0x15 / 255.0, green: 0x1b / 255.0, blue: 0x29 / 255.0, alpha: 1)

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

// The master at 96, 48, 32 and 16 px on the icon's navy, left to right.
write(png(284, 128, alpha: false) {
    navy.setFill()
    NSRect(x: 0, y: 0, width: 284, height: 128).fill()
    var x: CGFloat = 16
    for s: CGFloat in [96, 48, 32, 16] {
        seal.draw(in: NSRect(x: x, y: (128 - s) / 2, width: s, height: s))
        x += s + 24
    }
}, "app/icon/AppIcon-proof.png")

let tile = load("app/icon/press-seal-macos.svg")
for pt in [16, 32, 128, 256, 512] {
    for scale in [1, 2] {
        let px = pt * scale
        write(png(px, px, alpha: true) { tile.draw(in: NSRect(x: 0, y: 0, width: px, height: px)) },
              "\(macSet)/AppIcon-\(pt)x\(pt)@\(scale)x.png")
    }
}
