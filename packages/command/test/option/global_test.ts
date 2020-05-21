import { IFlagArgument, IFlagOptions } from '../../../flags/lib/types.ts';
import { Command } from '../../lib/command.ts';
import { assertEquals } from '../lib/assert.ts';

const cmd = new Command()
    .version( '0.1.0' )
    .option( '-b, --base', 'Only available on this command.' )
    .option( '-g, --global [val:custom]', 'Available on all command\'s.', { global: true } )
    .type( 'custom', (option: IFlagOptions, arg: IFlagArgument, value: string) => value.toUpperCase() )
    .command( 'sub-command', new Command()
        .option( '-l, --level2 [val:custom]', 'Only available on this command.' )
        .description( 'Some sub command.' )
        .command( 'sub-command', new Command()
            .option( '-L, --level3 [val:custom]', 'Only available on this command.' )
            .description( 'Some nested sub command.' )
        )
    );

Deno.test( 'command with global option', async () => {

    const { options, args } = await cmd.parse( [ '-g', 'halo' ] );

    assertEquals( options, { global: 'HALO' } );
    assertEquals( args, [] );
} );

Deno.test( 'sub command with global option', async () => {

    const { options, args } = await cmd.parse( [ 'sub-command', '-g', 'halo' ] );

    assertEquals( options, { global: 'HALO' } );
    assertEquals( args, [] );
} );

Deno.test( 'nested sub command with global option', async () => {

    const { options, args } = await cmd.parse( [ 'sub-command', 'sub-command', '-g', 'halo' ] );

    assertEquals( options, { global: 'HALO' } );
    assertEquals( args, [] );
} );

Deno.test( 'sub command with global option', async () => {

    const { options, args } = await cmd.parse( [ 'sub-command', '-l', 'halo' ] );

    assertEquals( options, { level2: 'HALO' } );
    assertEquals( args, [] );
} );

Deno.test( 'nested sub command with global option', async () => {

    const { options, args } = await cmd.parse( [ 'sub-command', 'sub-command', '-L', 'halo' ] );

    assertEquals( options, { level3: 'HALO' } );
    assertEquals( args, [] );
} );
