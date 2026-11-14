// © 2026 Eric G. Suchanek, PhD — Flux-Frontiers · SPDX-License-Identifier: LicenseRef-Flux-Frontiers-Proprietary
// The Knowledge Press. Not redistributable; see app/LICENSE.
//
// Opening lines for the launch splash, one chosen at each launch. Each is
// word for word from the book as the corpus holds it (its translation and
// edition), checked against web/public/books/<slug>.json when it was added.
// A line cut short ends in an ellipsis.

struct FirstLine {
    let line: String
    let title: String
    let author: String

    /// Seconds the splash stays: long enough to read the line once it has
    /// faded in, from 6 for "Call me Ishmael." to 10 for the longest.
    var hold: Double {
        min(10, max(6, 4 + Double(line.count) / 30))
    }

    static let all: [FirstLine] = [
        FirstLine(line: "It is a truth universally acknowledged, that a single man in possession of a good fortune must be in want of a wife.", title: "Pride and Prejudice", author: "Jane Austen"),
        FirstLine(line: "Call me Ishmael.", title: "Moby Dick", author: "Herman Melville"),
        FirstLine(line: "It was the best of times, it was the worst of times…", title: "A Tale of Two Cities", author: "Charles Dickens"),
        FirstLine(line: "Happy families are all alike; every unhappy family is unhappy in its own way.", title: "Anna Karenina", author: "Leo Tolstoy"),
        FirstLine(line: "You don’t know about me without you have read a book by the name of The Adventures of Tom Sawyer; but that ain’t no matter.", title: "Adventures of Huckleberry Finn", author: "Mark Twain"),
        FirstLine(line: "One morning, when Gregor Samsa woke from troubled dreams, he found himself transformed in his bed into a horrible vermin.", title: "The Metamorphosis", author: "Franz Kafka"),
        FirstLine(line: "There was no possibility of taking a walk that day.", title: "Jane Eyre", author: "Charlotte Brontë"),
        FirstLine(line: "My father’s family name being Pirrip, and my Christian name Philip, my infant tongue could make of both names nothing longer or more explicit than Pip.", title: "Great Expectations", author: "Charles Dickens"),
        FirstLine(line: "Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do…", title: "Alice’s Adventures in Wonderland", author: "Lewis Carroll"),
        FirstLine(line: "Emma Woodhouse, handsome, clever, and rich, with a comfortable home and happy disposition, seemed to unite some of the best blessings of existence…", title: "Emma", author: "Jane Austen"),
        FirstLine(line: "I celebrate myself, and sing myself…", title: "Leaves of Grass", author: "Walt Whitman"),
        FirstLine(line: "Once upon a midnight dreary, while I pondered, weak and weary…", title: "The Raven", author: "Edgar Allan Poe"),
        FirstLine(line: "Midway upon the journey of our life I found myself within a forest dark…", title: "The Divine Comedy", author: "Dante Alighieri"),
        FirstLine(line: "To Sherlock Holmes she is always the woman.", title: "The Adventures of Sherlock Holmes", author: "Arthur Conan Doyle"),
        FirstLine(line: "Whether I shall turn out to be the hero of my own life, or whether that station will be held by anybody else, these pages must show.", title: "David Copperfield", author: "Charles Dickens"),
        FirstLine(line: "The family of Dashwood had long been settled in Sussex.", title: "Sense and Sensibility", author: "Jane Austen"),
        FirstLine(line: "Tell me, O Muse, of that ingenious hero who travelled far and wide after he had sacked the famous town of Troy.", title: "The Odyssey", author: "Homer"),
        FirstLine(line: "Someone must have been telling lies about Josef K., he knew he had done nothing wrong but, one morning, he was arrested.", title: "The Trial", author: "Franz Kafka"),
        FirstLine(line: "Arms, and the man I sing, who, forc’d by fate…", title: "The Aeneid", author: "Virgil"),
        FirstLine(line: "No one would have believed in the last years of the nineteenth century that this world was being watched keenly and closely by intelligences greater than man’s and yet as mortal as his own…", title: "The War of the Worlds", author: "H. G. Wells"),
    ]
}
