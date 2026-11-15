"use strict";
const { IPTC_PACKET_PROGRAM } = require("./iptc-packet-program.js");
const { NIKON_REPAIR_PROGRAM } = require("./nikon-repair-program.js");

// Validate both producer defects before writing either repair. A single write
// avoids treating the other independently proven defect as a new read failure.
const PRODUCER_METADATA_PROGRAM = String.raw`my $producerWriter=Image::ExifTool->new;
${IPTC_PACKET_PROGRAM}
my $pendingIPTCDigest=sub {
    my($message)=@_;
    return $restoreIPTC && $message->{kind} eq 'Warning' &&
        $message->{text} eq 'IPTCDigest is not current. XMP may be out of sync' &&
        defined($targetIPTC->{digest}) && defined($sourceIPTC->{current}) && $targetIPTC->{digest} eq $sourceIPTC->{current};
};
${NIKON_REPAIR_PROGRAM}
my @targetMessages=(@{$targetIPTC->{messages}},@$nikonMessages);
push @targetMessages,{kind=>'Warning',text=>$targetWarning} if defined($targetWarning) && !$repair;
for my $message(@targetMessages) {
        next if $pendingIPTCDigest->($message);
        next if defined($nikonExpected) && $message->{kind} eq 'Warning' && $message->{text} eq '[minor] Bad NikonScanIFD directory';
        $add->($message->{text});
    }
if(!@failures && ($restoreIPTC || defined($nikonExpected))) {
    if(defined($sourceIPTC->{packet})) {
        my $original=$sourceIPTC->{packet};
        my($count,$error)=$producerWriter->SetNewValue('IPTC',\$original,Type=>'Raw',Protected=>1,Replace=>1);
        $add->($error);$add->('Original IPTC packet could not be queued') unless $count;
    }
    if(!@failures) {
        my $status=$producerWriter->WriteInfo($dst);
        for my $message(@{$messages->($producerWriter)}) {
            if($restoreIPTC && $message->{kind} eq 'Warning' && $message->{text} eq '[minor] Creating non-standard IPTC in PNG' &&
                $sourceIPTC->{mime} eq 'image/png' && $targetIPTC->{mime} eq 'image/png') { $targetIPTCNotice=$message->{text}; }
            else { $add->($message->{text}); }
        }
        $add->('Source-owned producer metadata could not be restored') unless $status==1 || $status==2;
        my $fresh=$makerSnapshot->($dst);
        $add->($_->{text}) for @{$fresh->{messages}};
        $add->('Restored Nikon metadata differs from the captured source') if defined($nikonExpected) &&
            ($fresh->{ambiguous} || $fresh->{unavailable} || !$same->($nikonExpected,$fresh->{tags}));
        if(defined($sourceIPTC->{packet})) {
            my $actual=$iptcState->($dst);
            $add->($_->{text}) for @{$actual->{messages}};
            $add->('Restored IPTC packet differs from the captured source') unless
                defined($actual->{packet}) && !ref($actual->{packet}) && $actual->{packet} eq $sourceIPTC->{packet};
        }
    }
}
`;

module.exports = { PRODUCER_METADATA_PROGRAM };
