// © 2026 Eric G. Suchanek, PhD — Flux-Frontiers · SPDX-License-Identifier: LicenseRef-Flux-Frontiers-Proprietary
// The Knowledge Press. Not redistributable; see app/LICENSE.
//
// Lines for the launch splash, one chosen at each launch: mostly openings, a
// few famous ones from near the start or further in (Yorick). Each is
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
        FirstLine(line: "Old Marley was as dead as a door-nail.", title: "A Christmas Carol", author: "Charles Dickens"),
        FirstLine(line: "Squire Trelawney, Dr. Livesey, and the rest of these gentlemen having asked me to write down the whole particulars about Treasure Island…", title: "Treasure Island", author: "Robert Louis Stevenson"),
        FirstLine(line: "1801—I have just returned from a visit to my landlord—the solitary neighbour that I shall be troubled with.", title: "Wuthering Heights", author: "Emily Brontë"),
        FirstLine(line: "The studio was filled with the rich odour of roses, and when the light summer wind stirred amidst the trees of the garden, there came through the open door the heavy scent of the lilac…", title: "The Picture of Dorian Gray", author: "Oscar Wilde"),
        FirstLine(line: "Mr. Utterson the lawyer was a man of a rugged countenance that was never lighted by a smile…", title: "Strange Case of Dr Jekyll and Mr Hyde", author: "Robert Louis Stevenson"),
        FirstLine(line: "I was born in the year 1632, in the city of York, of a good family, though not of that country, my father being a foreigner of Bremen, who settled first at Hull.", title: "Robinson Crusoe", author: "Daniel Defoe"),
        FirstLine(line: "Miss Brooke had that kind of beauty which seems to be thrown into relief by poor dress.", title: "Middlemarch", author: "George Eliot"),
        FirstLine(line: "While the present century was in its teens, and on one sunshiny morning in June, there drove up to the great iron gate of Miss Pinkerton’s academy for young ladies…", title: "Vanity Fair", author: "William Makepeace Thackeray"),
        FirstLine(line: "The Nellie, a cruising yawl, swung to her anchor without a flutter of the sails, and was at rest.", title: "Heart of Darkness", author: "Joseph Conrad"),
        FirstLine(line: "One may as well begin with Helen’s letters to her sister.", title: "Howards End", author: "E. M. Forster"),
        FirstLine(line: "When Farmer Oak smiled, the corners of his mouth spread till they were within an unimportant distance of his ears…", title: "Far from the Madding Crowd", author: "Thomas Hardy"),
        FirstLine(line: "It was seven o’clock of a very warm evening in the Seeonee hills when Father Wolf woke up from his day’s rest…", title: "The Jungle Book", author: "Rudyard Kipling"),
        FirstLine(line: "Buck did not read the newspapers, or he would have known that trouble was brewing…", title: "The Call of the Wild", author: "Jack London"),
        FirstLine(line: "Dark spruce forest frowned on either side the frozen waterway.", title: "White Fang", author: "Jack London"),
        FirstLine(line: "A throng of bearded men, in sad-coloured garments and grey steeple-crowned hats, intermixed with women, some wearing hoods, and others bareheaded, was assembled in front of a wooden edifice…", title: "The Scarlet Letter", author: "Nathaniel Hawthorne"),
        FirstLine(line: "The cold passed reluctantly from the earth, and the retiring fogs revealed an army stretched out on the hills, resting.", title: "The Red Badge of Courage", author: "Stephen Crane"),
        FirstLine(line: "On a January evening of the early seventies, Christine Nilsson was singing in Faust at the Academy of Music in New York.", title: "The Age of Innocence", author: "Edith Wharton"),
        FirstLine(line: "Selden paused in surprise.", title: "The House of Mirth", author: "Edith Wharton"),
        FirstLine(line: "I first heard of Ántonia on what seemed to me an interminable journey across the great midland plain of North America.", title: "My Ántonia", author: "Willa Cather"),
        FirstLine(line: "A green and yellow parrot, which hung in a cage outside the door, kept repeating over and over: “Allez vous-en! Allez vous-en! Sapristi! That’s all right!”", title: "The Awakening", author: "Kate Chopin"),
        FirstLine(line: "It is very seldom that mere ordinary people like John and myself secure ancestral halls for the summer.", title: "The Yellow Wallpaper", author: "Charlotte Perkins Gilman"),
        FirstLine(line: "I scarcely know where to begin, though I sometimes facetiously place the cause of it all to Charley Furuseth’s credit.", title: "The Sea-Wolf", author: "Jack London"),
        FirstLine(line: "The Time Traveller (for so it will be convenient to speak of him) was expounding a recondite matter to us.", title: "The Time Machine", author: "H. G. Wells"),
        FirstLine(line: "The stranger came early in February, one wintry day, through a biting wind and a driving snow…", title: "The Invisible Man", author: "H. G. Wells"),
        FirstLine(line: "I am a very old man; how old I do not know.", title: "A Princess of Mars", author: "Edgar Rice Burroughs"),
        FirstLine(line: "I call our world Flatland, not because we call it so, but to make its nature clearer to you, my happy readers, who are privileged to live in Space.", title: "Flatland: A Romance of Many Dimensions", author: "Edwin Abbott Abbott"),
        FirstLine(line: "The most merciful thing in the world, I think, is the inability of the human mind to correlate all its contents.", title: "The Call of Cthulhu", author: "H. P. Lovecraft"),
        FirstLine(line: "West of Arkham the hills rise wild, and there are valleys with deep woods that no axe has ever cut.", title: "The Colour Out of Space", author: "H. P. Lovecraft"),
        FirstLine(line: "I am forced into speech because men of science have refused to follow my advice without knowing why.", title: "At the Mountains of Madness", author: "H. P. Lovecraft"),
        FirstLine(line: "You will rejoice to hear that no disaster has accompanied the commencement of an enterprise which you have regarded with such evil forebodings.", title: "Frankenstein", author: "Mary Shelley"),
        FirstLine(line: "When I wrote the following pages, or rather the bulk of them, I lived alone, in the woods, a mile from any neighbor…", title: "Walden", author: "Henry David Thoreau"),
        FirstLine(line: "Between me and the other world there is ever an unasked question…", title: "The Souls of Black Folk", author: "W. E. B. Du Bois"),
        FirstLine(line: "I was born in Tuckahoe, near Hillsborough, and about twelve miles from Easton, in Talbot county, Maryland.", title: "Narrative of the Life of Frederick Douglass", author: "Frederick Douglass"),
        FirstLine(line: "Alas, poor Yorick. I knew him, Horatio, a fellow of infinite jest, of most excellent fancy.", title: "Hamlet", author: "William Shakespeare"),
        FirstLine(line: "When shall we three meet again?", title: "Macbeth", author: "William Shakespeare"),
        FirstLine(line: "Two households, both alike in dignity, In fair Verona, where we lay our scene…", title: "Romeo and Juliet", author: "William Shakespeare"),
        FirstLine(line: "In the beginning God created the heaven and the earth.", title: "The Bible", author: "King James Version"),
        FirstLine(line: "On an exceptionally hot evening early in July a young man came out of the garret in which he lodged…", title: "Crime and Punishment", author: "Fyodor Dostoyevsky"),
        FirstLine(line: "I am a sick man....", title: "Notes from Underground", author: "Fyodor Dostoyevsky"),
        FirstLine(line: "Well, Prince, so Genoa and Lucca are now just family estates of the Buonapartes.", title: "War and Peace", author: "Leo Tolstoy"),
        FirstLine(line: "The year 1866 was signalised by a remarkable incident, a mysterious and puzzling phenomenon, which doubtless no one has yet forgotten.", title: "Twenty Thousand Leagues Under the Sea", author: "Jules Verne"),
        FirstLine(line: "The Tao that can be trodden is not the enduring and unchanging Tao.", title: "Tao Te Ching", author: "Laozi"),
        FirstLine(line: "When Zarathustra was thirty years old, he left his home and the lake of his home, and went into the mountains.", title: "Thus Spake Zarathustra", author: "Friedrich Nietzsche"),
        FirstLine(line: "SUPPOSING that Truth is a woman—what then?", title: "Beyond Good and Evil", author: "Friedrich Nietzsche"),
        FirstLine(line: "All that we are is the result of what we have thought: it is founded on our thoughts, it is made up of our thoughts.", title: "The Dhammapada", author: "The Buddha"),
        FirstLine(line: "My father had a small estate in Nottinghamshire; I was the third of five sons.", title: "Gulliver’s Travels", author: "Jonathan Swift"),
        FirstLine(line: "In the first place, Cranford is in possession of the Amazons; all the holders of houses above a certain rent are women.", title: "Cranford", author: "Elizabeth Gaskell"),
        FirstLine(line: "He sat, in defiance of municipal orders, astride the gun Zam Zammah on her brick platform opposite the old Ajaib-Gher—the Wonder House, as the natives call the Lahore Museum.", title: "Kim", author: "Rudyard Kipling"),
        FirstLine(line: "The story had held us, round the fire, sufficiently breathless…", title: "The Turn of the Screw", author: "Henry James"),
        FirstLine(line: "In the bosom of one of those spacious coves which indent the eastern shore of the Hudson…", title: "The Legend of Sleepy Hollow", author: "Washington Irving"),
        FirstLine(line: "Six months at sea! Yes, reader, as I live, six months out of sight of land…", title: "Typee", author: "Herman Melville"),
        FirstLine(line: "Dear Son: I have ever had pleasure in obtaining any little anecdotes of my ancestors.", title: "Autobiography of Benjamin Franklin", author: "Benjamin Franklin"),
        FirstLine(line: "Some writers have so confounded society with government, as to leave little or no distinction between them…", title: "Common Sense", author: "Thomas Paine"),
        FirstLine(line: "Is there any knowledge in the world which is so certain that no reasonable man could doubt it?", title: "The Problems of Philosophy", author: "Bertrand Russell"),
        FirstLine(line: "Great art Thou, O Lord, and greatly to be praised; great is Thy power, and Thy wisdom infinite.", title: "Confessions", author: "Saint Augustine"),
        FirstLine(line: "On the 24th of February, 1815, the look-out at Notre-Dame de la Garde signalled the three-master, the Pharaon from Smyrna, Trieste, and Naples.", title: "The Count of Monte Cristo", author: "Alexandre Dumas"),
        FirstLine(line: "On the first Monday of the month of April, 1625, the market town of Meung, in which the author of Romance of the Rose was born, appeared to be in as perfect a state of revolution…", title: "The Three Musketeers", author: "Alexandre Dumas"),
        FirstLine(line: "In the shade of the house, in the sunshine of the riverbank near the boats, in the shade of the Sal-wood forest, in the shade of the fig tree is where Siddhartha grew up…", title: "Siddhartha", author: "Hermann Hesse"),
    ]
}
