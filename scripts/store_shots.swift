// © 2026 Eric G. Suchanek, PhD -- Flux-Frontiers -- SPDX-License-Identifier: LicenseRef-Flux-Frontiers-Proprietary
// The Knowledge Press. Not redistributable; see app/LICENSE.
//
// Composes App Store screenshots: each raw capture is scaled under a caption
// on the press's navy ground, at the exact size App Store Connect takes for
// its device, opaque (App Store Connect rejects an alpha channel). Run from the
// repo root with `make store-shots`.
//
//   swift scripts/store_shots.swift <raw dir> <captions.tsv> <out dir>
//
// make store-shots passes screenshots/raw, scripts/store_captions.tsv and
// screenshots/store/<version>.
//
// <raw dir>/<device>/<slot>-<name>.png, device iphone, ipad or mac, slot the
// two-digit key into captions.tsv. Writes <out dir>/<device>-<slot>.png and
// <out dir>/contact-<device>.png, then checks every output's size and alpha.

import AppKit
import CoreText
import UniformTypeIdentifiers

struct Device {
    let name: String
    let width: Int
    let height: Int
    let fontSize: Double  // caption size in pixels
    let radius: Double    // screenshot corner radius, as a fraction of its width
}

let devices = [
    Device(name: "iphone", width: 1320, height: 2868, fontSize: 80, radius: 0.10),
    Device(name: "ipad", width: 2752, height: 2064, fontSize: 92, radius: 0.02),  // landscape
    Device(name: "mac", width: 2880, height: 1800, fontSize: 92, radius: 0.012),
]

func color(_ hex: Int) -> NSColor {
    NSColor(srgbRed: Double(hex >> 16 & 0xff) / 255, green: Double(hex >> 8 & 0xff) / 255,
            blue: Double(hex & 0xff) / 255, alpha: 1)
}
let ink = color(0x151b29)
let paper = color(0xf4f0dc)
let seal = color(0x2dcc78)

let args = CommandLine.arguments
guard args.count == 4 else {
    print("usage: swift scripts/store_shots.swift <raw dir> <captions.tsv> <out dir>")
    exit(2)
}
let rawDir = args[1], captionsPath = args[2], outDir = args[3]

let fontURL = URL(fileURLWithPath: "assets/brand-system/fonts/Merriweather-Bold.ttf")
CTFontManagerRegisterFontsForURL(fontURL as CFURL, .process, nil)

/// Reads captions.tsv into slot -> caption, skipping comments and blank lines.
///
/// :param path: the captions file
/// :return: the captions by two-digit slot
func readCaptions(_ path: String) -> [String: String] {
    guard let text = try? String(contentsOfFile: path, encoding: .utf8) else {
        fatalError("cannot read \(path)")
    }
    var out: [String: String] = [:]
    for line in text.split(separator: "\n") where !line.hasPrefix("#") {
        let parts = line.split(separator: "\t", maxSplits: 1)
        if parts.count == 2 { out[String(parts[0])] = String(parts[1]) }
    }
    return out
}

/// Draws into an opaque sRGB bitmap and returns it as PNG data.
///
/// :param w: width in pixels
/// :param h: height in pixels
/// :param body: AppKit drawing, origin at the bottom left
func png(_ w: Int, _ h: Int, _ body: () -> Void) -> Data {
    let cg = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: 0,
                       space: CGColorSpace(name: CGColorSpace.sRGB)!,
                       bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
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

/// Lays one screenshot out under its caption at the device's store size.
///
/// :param shot: the raw capture
/// :param caption: the caption text
/// :param d: the device
func compose(_ shot: NSImage, _ caption: String, _ d: Device) -> Data {
    let W = Double(d.width), H = Double(d.height)
    let margin = W * 0.07
    return png(d.width, d.height) {
        ink.setFill()
        NSRect(x: 0, y: 0, width: W, height: H).fill()

        // Caption, centered at the top; the band is as tall as the text needs.
        let style = NSMutableParagraphStyle()
        style.alignment = .center
        style.lineBreakMode = .byWordWrapping
        style.lineHeightMultiple = 1.08
        let font = NSFont(name: "Merriweather-Bold", size: d.fontSize)
            ?? NSFont.boldSystemFont(ofSize: d.fontSize)
        let text = NSAttributedString(string: caption, attributes: [
            .font: font, .foregroundColor: paper, .paragraphStyle: style,
        ])
        let textW = W - 2 * margin
        let box = text.boundingRect(with: NSSize(width: textW, height: H / 3),
                                    options: [.usesLineFragmentOrigin, .usesFontLeading])
        let textTop = H - d.fontSize * 0.9
        text.draw(with: NSRect(x: margin, y: textTop - box.height, width: textW, height: box.height),
                  options: [.usesLineFragmentOrigin, .usesFontLeading])

        // A short seal-green rule under the caption.
        seal.setFill()
        let ruleW = W * 0.08
        let ruleY = textTop - box.height - d.fontSize * 0.45
        NSRect(x: (W - ruleW) / 2, y: ruleY, width: ruleW, height: max(4, d.fontSize * 0.07)).fill()

        // The screenshot, scaled to fit below the rule, corners rounded.
        let areaW = W - 2 * margin, areaH = ruleY - d.fontSize * 0.6 - margin
        let s = min(areaW / shot.size.width, areaH / shot.size.height)
        let w = shot.size.width * s, h = shot.size.height * s
        let rect = NSRect(x: (W - w) / 2, y: margin + (areaH - h) / 2, width: w, height: h)
        let path = NSBezierPath(roundedRect: rect, xRadius: w * d.radius, yRadius: w * d.radius)
        NSGraphicsContext.saveGraphicsState()
        path.addClip()
        shot.draw(in: rect, from: .zero, operation: .copy, fraction: 1)
        NSGraphicsContext.restoreGraphicsState()
        paper.withAlphaComponent(0.18).setStroke()
        path.lineWidth = max(2, W * 0.002)
        path.stroke()
    }
}

/// Lays the device's finished screenshots side by side, for review.
///
/// :param shots: the composed screenshots, in slot order
/// :param d: the device
func contact(_ shots: [NSImage], _ d: Device) -> Data {
    let thumbH = 900.0
    let thumbW = thumbH * Double(d.width) / Double(d.height)
    let gap = 40.0
    let W = gap + Double(shots.count) * (thumbW + gap), H = thumbH + 2 * gap
    return png(Int(W), Int(H)) {
        color(0x2a3246).setFill()
        NSRect(x: 0, y: 0, width: W, height: H).fill()
        for (i, img) in shots.enumerated() {
            img.draw(in: NSRect(x: gap + Double(i) * (thumbW + gap), y: gap, width: thumbW, height: thumbH))
        }
    }
}

let captions = readCaptions(captionsPath)
let fm = FileManager.default
try? fm.createDirectory(atPath: outDir, withIntermediateDirectories: true)
var failures = 0
var total = 0

for d in devices {
    let dir = "\(rawDir)/\(d.name)"
    guard let files = try? fm.contentsOfDirectory(atPath: dir) else { continue }
    let raws = files.filter { $0.hasSuffix(".png") }.sorted()
    var made: [NSImage] = []
    for file in raws {
        let slot = String(file.prefix(2))
        guard let caption = captions[slot] else {
            print("skip \(dir)/\(file): no caption for slot \(slot)")
            failures += 1
            continue
        }
        guard let shot = NSImage(contentsOfFile: "\(dir)/\(file)") else { fatalError("cannot load \(file)") }
        // A capture in the other orientation would be shrunk to a strip.
        if (shot.size.width > shot.size.height) != (d.width > d.height) {
            print("FAIL \(dir)/\(file): \(d.width > d.height ? "portrait" : "landscape") capture, \(d.name) wants \(d.width > d.height ? "landscape" : "portrait")")
            failures += 1
            continue
        }
        let data = compose(shot, caption, d)
        let out = "\(outDir)/\(d.name)-\(slot).png"
        try! data.write(to: URL(fileURLWithPath: out))

        // Check what App Store Connect checks: exact size, no alpha.
        let rep = NSBitmapImageRep(data: data)!
        let ok = rep.pixelsWide == d.width && rep.pixelsHigh == d.height && !rep.hasAlpha
        print("\(ok ? "ok  " : "FAIL") \(out) \(rep.pixelsWide)x\(rep.pixelsHigh) alpha=\(rep.hasAlpha)")
        if !ok { failures += 1 }
        made.append(NSImage(data: data)!)
    }
    if !made.isEmpty {
        let out = "\(outDir)/contact-\(d.name).png"
        try! contact(made, d).write(to: URL(fileURLWithPath: out))
        print("     \(out)")
    }
    if made.count > 10 { print("FAIL \(d.name): \(made.count) screenshots, the store takes 10"); failures += 1 }
    total += made.count
}
if total == 0 {
    print("FAIL no raw captures under \(rawDir)/{iphone,ipad,mac}/")
    failures += 1
}
exit(failures == 0 ? 0 : 1)
