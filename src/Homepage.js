import React from 'react';
import { Container, Typography, Box, Button, List, ListItem, ListItemText } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import CheckIcon from '@mui/icons-material/Check';
import {  ListItemIcon } from '@mui/material'
import PeopleIcon from '@mui/icons-material/People';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import { useState, useEffect, useRef } from 'react';



export default function HomePage() {
  const navigate = useNavigate();

const handleStartRiding = () => {
  navigate('/getstarted', { state: { defaultUserType: 'Passenger' } });
};

const handleStartDriving = () => {
  navigate('/getstarted', { state: { defaultUserType: 'Driver' } });
};



  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.1 } // trigger a little earlier
    );

    if (ref.current) observer.observe(ref.current);

    return () => observer.disconnect();
  }, []);

  return (

    <>
{/* Full width header outside Container */}
<Box
  sx={{
    bgcolor: '#82b1ff',
    color: 'white',
    p: 2,
    textAlign: 'left',
    fontWeight: 'bold',
    fontSize: '1.5rem',
    pl: { xs: 2, sm: '50px' },
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap', // allow wrapping on small screens
  }}
>
  {/* Logo + Brand */}
  <Box sx={{ display: 'flex', alignItems: 'center' }}>
    <Box
      component="img"
      src="/taxifav.png"
      alt="Taxi Icon"
      sx={{
        width: 35,
        height: 35,
        mt: -1.25,
        ml: { xs: 1, sm: 15 },
      }}
    />
    <Box
      component="span"
      sx={{
        fontWeight: 'bold',
        fontSize: { xs: '1.25rem', sm: '1.75rem' },
        ml: '10px',
      }}
    >
      SWYFT
    </Box>
  </Box>

  {/* Action Buttons */}
  <Box
    sx={{
      display: 'flex',
      gap: 2,
      flexDirection: { xs: 'column', sm: 'row' }, // stack on mobile
      alignItems: 'center',
      mr: { xs: 0, sm: 15 },
      mt: { xs: 2, sm: 0 },
    }}
  >
    <Button
      variant="contained"
      onClick={() => navigate('/getstarted')}
      sx={{
        borderRadius: '15px',
        backgroundColor: '#ffffff',
        fontWeight: 'bold',
        px: { xs: 2, sm: 3 },
        py: { xs: 1, sm: 1.25 },
        color: '#000000',
        '&:hover': {
          backgroundColor: '#f0f0f0',
        },
      }}
    >
      Get Started
    </Button>

    <Button
      variant="outlined"
      onClick={() => navigate('/signin')}
      sx={{
        borderRadius: '15px',
        borderColor: '#ffffff',
        color: '#ffffff',
        fontWeight: 'bold',
        px: { xs: 2, sm: 3 },
        py: { xs: 1, sm: 1.25 },
        '&:hover': {
          backgroundColor: 'rgba(255,255,255,0.15)',
          borderColor: '#ffffff',
        },
      }}
    >
      Sign In
    </Button>
  </Box>
</Box>



      {/* Main header */}
      <Container maxWidth="md" sx={{ mt: 6, mb: 4, textAlign: 'center' }}>
        <Typography variant="h3" fontWeight="bold" gutterBottom  sx={{ color: '#4e4e4eff'  }}>
          Your Ride, Your Way
        </Typography>
        <Typography variant="h6" color="text.secondary">
          Connect with drivers in your area or offer rides to passengers. Join our community of reliable transportation.
        </Typography>
      </Container>

      {/* Side-by-side Containers */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          gap: 2, // space between containers
          px: 2,
          flexWrap: 'wrap',
        }}
      >
        {/* Passenger Container */}
       <Container
            maxWidth="sm"
            sx={{
              border: 'none',
              borderRadius: 2,
              p: 5,
              boxShadow: 'none',
              bgcolor: 'transparent',
              flex: '1 1 400px', // flexible width but minimum 400px
              textAlign: 'center', // center text and heading
            }}
          >
            {/* People Icon in a Circle */}
            <Box
              sx={{
                width: 70,
                height: 70,
                bgcolor: '#325575',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 2,
              }}
            >
              <PeopleIcon sx={{ color: '#fff', fontSize: 40 }} />
            </Box>

            <Typography variant="h5" fontWeight="bold" gutterBottom>
              For Passengers
            </Typography>

            <Typography variant="body1" gutterBottom>
              Book reliable rides with trusted drivers in your area. Safe, convenient, and affordable transportation.
            </Typography>

            <List>
              {[
                "Book rides instantly",
                "Track your driver in real-time",
                "Safe and secure payments",
                "Rate your experience",
              ].map((text, index) => (
                <ListItem key={index}>
                  <ListItemIcon>
                    <CheckIcon sx={{ color: 'green' }} />
                  </ListItemIcon>
                  <ListItemText primary={text} />
                </ListItem>
              ))}
            </List>

            <Button
              variant="contained"
              size="large"
              sx={{ mt: 2 }}
              onClick={handleStartRiding}
            >
              Start Riding
            </Button>
          </Container>

        {/* Driver Container */}


<Container
  maxWidth="sm"
  sx={{
    border: 'none',
    borderRadius: 2,
    p: 3,
    boxShadow: 'none',
    bgcolor: 'transparent',
    flex: '1 1 400px',
    textAlign: 'center', // center heading and text
  }}
>
  {/* Car Icon in a Circle */}
  <Box
    sx={{
      width: 70,
      height: 70,
      bgcolor: '#325575',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      mx: 'auto',
      mb: 2,
    }}
  >
    <DirectionsCarIcon sx={{ color: '#fff', fontSize: 40 }} />
  </Box>

  <Typography variant="h5" fontWeight="bold" gutterBottom>
    For Drivers
  </Typography>

  <Typography variant="body1" gutterBottom>
    Turn your car into an income opportunity. Drive when you want, earn money on your schedule.
  </Typography>

  <List>
    {[
      "Flexible working hours",
      "Competitive earnings",
      "Weekly payments",
      "Build your reputation",
    ].map((text, index) => (
      <ListItem key={index}>
        <ListItemIcon>
          <CheckIcon sx={{ color: 'green' }} />
        </ListItemIcon>
        <ListItemText primary={text} />
      </ListItem>
    ))}
  </List>

   <Button
              variant="contained"
              size="large"
              sx={{ mt: 2 }}
              onClick={handleStartDriving}
            >
              Start Driving
             </Button>
  
</Container>

      </Box>
    {/* Swyft tagline block */}
      <Container
        ref={ref}
        maxWidth="md"
        sx={{
             mt: { xs: 4, sm: 6 },     // smaller top margin on mobile
              mb: { xs: 3, sm: 4 },     // smaller bottom margin on mobile
              textAlign: 'center',
              px: { xs: 2, sm: 0 },     // padding adjustment
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0)' : 'translateY(60px)',
              transition: 'opacity 1s ease-out, transform 1s ease-out',
                  }}
      >
       
<Box
  sx={{
    display: 'flex',
    flexDirection: { xs: 'column', md: 'row' }, // stack vertically on small screens
    alignItems: { xs: 'center', md: 'flex-start' }, // center image/text on mobile
    gap: 3,
    textAlign: { xs: 'center', md: 'left' }, // center text on mobile
  }}
>
  {/* Text Section */}
  <Box>
    <Typography variant="h2" fontWeight="bold" gutterBottom sx={{ color: '#4e4e4eff' }}> Moving You, Smarter</Typography>
    <Typography  variant="h6" color="text.secondary" gutterBottom>
      By sharing our industry insights and real-time ride data, we make city travel faster, safer, and easier for everyone.
    </Typography>
  </Box>
  {/* Image Section */}
  <Box component="img" src="/ri1.jpg"  alt="Smarter city travel" 
    sx={{   width: { xs: '100%', md: 300 }, height: { xs: 'auto', md: 400 }, borderRadius: 2 ,mt: { xs: 2, md: 0 }, // spacing when stacked vertically
   alignSelf: { xs: 'center', md: 'flex-start' }, }}
  />
</Box>

<Box
  sx={{
    display: 'flex',
    flexDirection: 'column', // only vertical
    alignItems: 'center', // center horizontally
    gap: 3,
    mt: 4,
    textAlign: 'center', // center text
  }}
>
  <Box>
    <Typography
      variant="h4"
      fontWeight="bold"
      gutterBottom
      sx={{ color: '#4e4e4eff' }}
    >
      Faster ways to move
    </Typography>
    <Typography variant="h6" color="text.secondary" gutterBottom>
      Our tips and data help drivers and riders get around efficiently, keeping
      cities connected and convenient.
    </Typography>
  </Box>
</Box>

{/* Block 2 */}
<Box
  sx={{
    display: 'flex',
    flexDirection: 'column', // only vertical now
    alignItems: 'center', // center horizontally
    gap: 3,
    mt: 4,
    textAlign: 'center', // center text
  }}
>
  <Box>
    <Typography
      variant="h4"
      fontWeight="bold"
      gutterBottom
      sx={{ color: '#4e4e4eff' }}
    >
      Ride Faster, Live Better
    </Typography>
    <Typography variant="h6" color="text.secondary" gutterBottom>
      By connecting riders with trusted drivers instantly, we make your commute
      smooth and stress-free.
    </Typography>
  </Box>
</Box>


{/* Block 3 */}
<Box
  sx={{
    display: 'flex',
    flexDirection: { xs: 'column', md: 'row' },
    alignItems: { xs: 'center', md: 'flex-start' },
    gap: 3,
    mt: 4,
  }}
>
  <Box
    component="img"
    src="/ri4.jpg"
    alt="Ride Faster, Live Better"
    sx={{
      width: { xs: '100%', md: 500 },
      height: { xs: 'auto', md: 400 },
      borderRadius: 2,
      mt: { xs: 2, md: 0 },
      order: { xs: 2, md: 1 }, // image first on md+
    }}
  />
  <Box
    sx={{
      textAlign: { xs: 'center', md: 'right' },
      order: { xs: 1, md: 2 }, // text second on md+
    }}
  >
    <Typography
      variant="h2"
      fontWeight="bold"
      gutterBottom
      sx={{ color: '#4e4e4eff' }}
    >
      Connected travel
    </Typography>
    <Typography variant="h6" color="text.secondary" gutterBottom>
      By connecting riders with trusted drivers instantly, we make your commute smooth and stress-free.
    </Typography>
  </Box>
 </Box> 

{/* Block 4 */}
<Box
  sx={{
    display: 'flex',
    flexDirection: { xs: 'column', md: 'row' },
    alignItems: { xs: 'center', md: 'flex-start' },
    gap: 3,
    mt: 4,
  }}
>
  <Box sx={{ textAlign: { xs: 'center', md: 'left' } }}>
    <Typography variant="h4" fontWeight="bold" gutterBottom sx={{ color: '#4e4e4eff' }}>
      Your city, Your Ride
    </Typography>
    <Typography variant="h6" color="text.secondary" gutterBottom>
      Discover smarter ways to get around with local drivers who know the roads best.
    </Typography>
  </Box>

</Box>

   
        <Button variant="text" sx={{ mt: 2, fontWeight: 'bold' }}>
          Learn more
        </Button>
          <Box
    component="img"
    src="/ri5.jpg"
    alt="Your city, Your Ride"
    sx={{
      width: { xs: '100%', md: 800 },
      height: { xs: 'auto', md: 400 },
      borderRadius: 2,
      mt: { xs: 2, md: 0 },
      alignSelf: { xs: 'center', md: 'flex-start' },
    }}
  />
      </Container>


    </>
  );
}
